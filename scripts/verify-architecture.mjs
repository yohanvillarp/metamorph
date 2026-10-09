#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';

const ROOT_DIR = resolve('.');
let errorsFound = 0;
let warningsFound = 0;

function logError(msg) {
  console.error(`\x1b[31m[ARCH-ERR]\x1b[0m ${msg}`);
  errorsFound++;
}

function logWarning(msg) {
  console.warn(`\x1b[33m[ARCH-WARN]\x1b[0m ${msg}`);
  warningsFound++;
}

function logSuccess(msg) {
  console.log(`\x1b[32m[ARCH-OK]\x1b[0m ${msg}`);
}

function getAllFiles(dir, filter = () => true) {
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry !== 'node_modules' && entry !== 'dist' && entry !== '.turbo' && entry !== '.git') {
          files.push(...getAllFiles(fullPath, filter));
        }
      } else if (filter(entry)) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

// ─────────────────────────────────────────────────────────────
// Rule 1: Hexagonal Zero-I/O Invariant in @nikelyh/domain
// ─────────────────────────────────────────────────────────────
console.log('\n🔍 Checking Invariant 1: @nikelyh/domain Zero-I/O purity...');
const domainSrc = join(ROOT_DIR, 'packages/@nikelyh/domain/src');
const domainFiles = getAllFiles(domainSrc, (f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));

const FORBIDDEN_DOMAIN_IMPORTS = [
  'node:fs',
  'fs',
  'node:sqlite',
  'better-sqlite3',
  'express',
  '@mozaik-ai/core',
  'node:child_process',
  'child_process',
  'node:net',
  'net',
  'node:http',
  'http',
];

for (const file of domainFiles) {
  const content = readFileSync(file, 'utf-8');
  // Remove multiline template literals (`...`) to avoid false positives on code examples in catalogs
  const sanitized = content.replace(/`[\s\S]*?`/g, '');
  const lines = sanitized.split('\n');

  lines.forEach((line, idx) => {
    // Only test actual import/require declarations
    const importMatch = line.match(/^\s*import\s+.*from\s+['"]([^'"]+)['"]/);
    const requireMatch = line.match(/^\s*(?:const|let|var)\s+.*=\s*require\(['"]([^'"]+)['"]\)/);
    const importedModule = importMatch?.[1] || requireMatch?.[1];

    if (importedModule && FORBIDDEN_DOMAIN_IMPORTS.includes(importedModule)) {
      logError(
        `Domain Zero-I/O violation in ${relative(ROOT_DIR, file)}:${idx + 1} -> Forbidden import: "${importedModule}"`
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Rule 2: Feature-Sliced Design (FSD) Layering in apps/dashboard
// Hierarchy: shared (0) -> entities (1) -> features (2) -> widgets (3) -> pages (4) -> app (5)
// Lower layers CANNOT import from higher layers.
// ─────────────────────────────────────────────────────────────
console.log('🔍 Checking Invariant 2: Dashboard Feature-Sliced Design (FSD) dependency flow...');
const dashboardSrc = join(ROOT_DIR, 'apps/dashboard/src');
const dashboardFiles = getAllFiles(dashboardSrc, (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.d.ts'));

const FSD_LEVELS = {
  shared: 0,
  entities: 1,
  features: 2,
  widgets: 3,
  pages: 4,
  app: 5,
};

for (const file of dashboardFiles) {
  const relPath = relative(dashboardSrc, file).replace(/\\/g, '/');
  const sourceLayer = Object.keys(FSD_LEVELS).find((layer) => relPath.startsWith(`${layer}/`));
  if (!sourceLayer) continue;

  const sourceLevel = FSD_LEVELS[sourceLayer];
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Match aliases like '@/widgets/...' or relative imports
    const match = line.match(/from\s+['"](@\/|\.\.\/|\.\/)([^'"]+)['"]/);
    if (!match) return;

    let targetPath = match[2];
    let targetLayer = null;

    if (match[1] === '@/') {
      targetLayer = Object.keys(FSD_LEVELS).find((l) => targetPath.startsWith(`${l}/`) || targetPath === l);
    } else {
      const resolved = resolve(dirname(file), match[1] + match[2]);
      const relToSrc = relative(dashboardSrc, resolved).replace(/\\/g, '/');
      targetLayer = Object.keys(FSD_LEVELS).find((l) => relToSrc.startsWith(`${l}/`));
    }

    if (targetLayer && FSD_LEVELS[targetLayer] > sourceLevel) {
      logError(
        `FSD Layer violation in ${relative(ROOT_DIR, file)}:${idx + 1} -> Layer "${sourceLayer}" cannot import from higher layer "${targetLayer}".`
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Rule 3: File Density and Flat Directory Anti-Bloating
// Maximum 12 non-test source files in a single flat directory
// ─────────────────────────────────────────────────────────────
console.log('🔍 Checking Invariant 3: Directory density and vertical slice hygiene...');
function checkDirectoryDensity(dir) {
  try {
    const entries = readdirSync(dir);
    let codeFilesCount = 0;
    const subdirs = [];

    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (!['node_modules', 'dist', '.turbo', '.git', 'public'].includes(entry)) {
          subdirs.push(full);
        }
      } else if (
        (entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.js')) &&
        !entry.endsWith('.test.ts') &&
        !entry.endsWith('.d.ts')
      ) {
        codeFilesCount++;
      }
    }

    const MAX_FILES_PER_DIR = 12;
    if (codeFilesCount > MAX_FILES_PER_DIR) {
      logWarning(
        `Directory bloating in ${relative(ROOT_DIR, dir)}: contains ${codeFilesCount} files (limit is ${MAX_FILES_PER_DIR}). Consider decomposing into vertical feature slices.`
      );
    }

    for (const sub of subdirs) {
      checkDirectoryDensity(sub);
    }
  } catch {}
}

checkDirectoryDensity(join(ROOT_DIR, 'packages/@nikelyh'));
checkDirectoryDensity(join(ROOT_DIR, 'apps/dashboard/src'));

console.log('\n─────────────────────────────────────────────────────────────');
if (errorsFound > 0) {
  console.error(`❌ Architecture check failed with ${errorsFound} error(s) and ${warningsFound} warning(s).\n`);
  process.exit(1);
} else {
  logSuccess(`Architecture check passed cleanly! (${warningsFound} warning(s))\n`);
  process.exit(0);
}
