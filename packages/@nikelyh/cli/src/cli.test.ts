import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('CLI Contract & Build Integrity', () => {
  const cliDir = path.resolve(import.meta.dirname, '..');
  const pkgPath = path.join(cliDir, 'package.json');
  const indexPath = path.join(cliDir, 'src/index.ts');
  const distDir = path.join(cliDir, 'dist');

  test('version in src/index.ts matches package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    const match = indexContent.match(/\.version\(['"]([^'"]+)['"]\)/);
    assert.ok(match, 'Expected to find .version(...) in src/index.ts');
    assert.equal(match[1], pkg.version, `CLI version (${match[1]}) must match package.json version (${pkg.version})`);
  });

  test('no unprefixed sqlite imports exist in built dist files', () => {
    if (!fs.existsSync(distDir)) {
      // If dist has not been built yet, skip gracefully
      return;
    }

    const files = fs.readdirSync(distDir).filter((f) => f.endsWith('.js'));
    assert.ok(files.length > 0, 'Expected dist to contain .js bundle files');

    for (const file of files) {
      const filePath = path.join(distDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      const unprefixedFrom = /from\s+["']sqlite["']/.test(content);
      const unprefixedImport = /import\s*\(\s*["']sqlite["']\s*\)/.test(content);

      assert.equal(
        unprefixedFrom || unprefixedImport,
        false,
        `File ${file} contains illegal unprefixed "sqlite" import! Must use "node:sqlite".`
      );
    }
  });

  test('dashboard UI is bundled in dist/public if dist exists', () => {
    if (!fs.existsSync(distDir)) return;
    const publicDir = path.join(distDir, 'public');
    const indexHtml = path.join(publicDir, 'index.html');
    assert.ok(fs.existsSync(publicDir), 'Expected dist/public to exist in CLI build');
    assert.ok(fs.existsSync(indexHtml), 'Expected dist/public/index.html to exist');
  });

  test('src/index.ts registers config command and run command options', () => {
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    assert.ok(indexContent.includes('registerConfigCommand(program)'), 'Expected registerConfigCommand to be called');
    assert.ok(indexContent.includes('--model <model>'), 'Expected --model option in run command');
    assert.ok(indexContent.includes('--concurrency <number>'), 'Expected --concurrency option in run command');
    assert.ok(indexContent.includes('--timeout <seconds>'), 'Expected --timeout option in run command');
    assert.ok(indexContent.includes('--retries <number>'), 'Expected --retries option in run command');
  });
});

