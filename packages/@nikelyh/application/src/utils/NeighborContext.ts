import * as fs from 'fs';
import * as path from 'path';
import { findShadowRoot } from './NextMigrationHints';

const MAX_FILES = 8;
const MAX_FILE_CHARS = 4000;
const MAX_TOTAL_CHARS = 24000;

function readTruncated(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (raw.length <= MAX_FILE_CHARS) return raw;
    return `${raw.slice(0, MAX_FILE_CHARS)}\n\n/* … truncated (${raw.length} chars) */`;
  } catch {
    return null;
  }
}

function findSrcRoot(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/src/');
  if (idx === -1) return null;
  return filePath.slice(0, idx + 4);
}

function resolveImport(fromFile: string, spec: string): string | null {
  const dir = path.dirname(fromFile);
  const base = spec.startsWith('@/')
    ? (() => {
        const src = findSrcRoot(fromFile);
        return src ? path.join(src, spec.slice(2)) : path.resolve(dir, spec);
      })()
    : path.resolve(dir, spec);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}.vue`,
    `${base}.svelte`,
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
    path.join(base, 'index.vue'),
    path.join(base, 'index.svelte'),
  ];
  return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) || null;
}

function localImportSpecs(content: string): string[] {
  const specs: string[] = [];
  const re = /from\s+['"](\.\.?\/[^'"]+|@\/[^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) specs.push(match[1]);
  return specs;
}

function listNearbyModules(fromFile: string, limit: number): string[] {
  const shadow = findShadowRoot(fromFile);
  const src = findSrcRoot(fromFile) || (shadow ? path.join(shadow, 'src') : path.dirname(fromFile));
  if (!fs.existsSync(src)) return [];
  const interesting = /(?:Page|page|View|Screen|layout|Layout|main|App|routes|Routes|app\.routes)\.(t|j)sx?$|\.(vue|svelte)$/;
  const out: string[] = [];
  const stack = [src];
  while (stack.length > 0 && out.length < limit) {
    const dir = stack.pop() as string;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (interesting.test(entry.name)) out.push(full);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Deterministic neighbor pack so the LLM can deduce APIs instead of inventing them.
 * Not tied to a sample app: current file + local imports + nearby screen/bootstrap paths.
 */
export function buildNeighborContext(filePath: string): string {
  const sections: string[] = [];
  let budget = MAX_TOTAL_CHARS;

  const push = (title: string, body: string) => {
    const block = `### ${title}\n\`\`\`\n${body}\n\`\`\`\n`;
    if (block.length > budget) return;
    budget -= block.length;
    sections.push(block);
  };

  const self = readTruncated(filePath);
  if (self) {
    push(filePath, self);
  } else {
    sections.push(`### ${filePath}\n(file does not exist yet — you may need to create it)\n`);
  }

  const importSpecs = self ? localImportSpecs(self) : [];
  const resolved = importSpecs
    .map((spec) => resolveImport(filePath, spec))
    .filter((file): file is string => Boolean(file && file !== path.resolve(filePath)));

  const unique = [...new Set(resolved)].slice(0, MAX_FILES);
  for (const dep of unique) {
    const body = readTruncated(dep);
    if (body) push(`imported: ${dep}`, body);
  }

  const nearby = listNearbyModules(filePath, 24).filter((file) => path.resolve(file) !== path.resolve(filePath));
  if (nearby.length > 0) {
    const listing = nearby.map((file) => path.relative(findShadowRoot(filePath) || path.dirname(filePath), file)).join('\n');
    sections.push(`### Nearby screen / bootstrap files (paths only — read before inventing a new UI)\n${listing}\n`);
  }

  if (sections.length === 0) return '';
  return `\nEvidence from disk (read this before editing; match existing exports and callback prop names):\n${sections.join('\n')}`;
}
