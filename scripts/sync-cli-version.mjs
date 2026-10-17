#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const CLI_PKG_PATH = join(ROOT_DIR, 'packages', '@nikelyh', 'cli', 'package.json');
const CLI_INDEX_PATH = join(ROOT_DIR, 'packages', '@nikelyh', 'cli', 'src', 'index.ts');

function syncCliVersion() {
  const pkgRaw = readFileSync(CLI_PKG_PATH, 'utf-8');
  const pkg = JSON.parse(pkgRaw);
  const targetVersion = pkg.version;

  console.log(`\x1b[34m[SYNC]\x1b[0m Synchronizing CLI src/index.ts version with package.json (${targetVersion})...`);

  // Update packages/@nikelyh/cli/src/index.ts
  const indexContent = readFileSync(CLI_INDEX_PATH, 'utf-8');
  const versionRegex = /\.version\(['"][^'"]+['"]\)/;

  if (!versionRegex.test(indexContent)) {
    throw new Error(`Could not find .version(...) declaration in ${CLI_INDEX_PATH}`);
  }

  const updatedIndex = indexContent.replace(versionRegex, `.version('${targetVersion}')`);
  writeFileSync(CLI_INDEX_PATH, updatedIndex, 'utf-8');
  console.log(`\x1b[32m[OK]\x1b[0m Updated ${CLI_INDEX_PATH} -> .version('${targetVersion}')`);

  // Ensure package-lock.json reflects the new version
  try {
    execSync('npm install --package-lock-only', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log(`\x1b[32m[OK]\x1b[0m package-lock.json synchronized`);
  } catch (err) {
    console.warn(`\x1b[33m[WARN]\x1b[0m Could not update package-lock.json: ${err.message}`);
  }

  console.log(`\x1b[32m[SUCCESS]\x1b[0m CLI entrypoint is in sync with package.json version ${targetVersion}`);
}

syncCliVersion();
