import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { parseImplicatedFiles } from './BuildTools';

describe('BuildTools - parseImplicatedFiles', () => {
  const tmpDirs: string[] = [];

  function createTestShadow(): string {
    const dir = path.join(os.tmpdir(), `metamorph-build-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    tmpDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tmpDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
    tmpDirs.length = 0;
  });

  test('parses existing files from compiler output', () => {
    const shadow = createTestShadow();
    const existingFile = path.join(shadow, 'src', 'Index.tsx');
    fs.writeFileSync(existingFile, 'export const Index = () => null;');

    const output = `Error in src/Index.tsx:10:5: Type error`;
    const files = parseImplicatedFiles(output, shadow);

    assert.equal(files.length, 1);
    assert.equal(files[0], path.resolve(existingFile));
  });

  test('includes missing files referenced in compiler errors under shadow root', () => {
    const shadow = createTestShadow();
    // Missing file that does NOT exist on disk yet
    const missingFile = path.join(shadow, 'src', 'Missing.tsx');
    assert.equal(fs.existsSync(missingFile), false);

    const output = `Module not found: Can't resolve 'src/Missing.tsx'`;
    const files = parseImplicatedFiles(output, shadow);

    assert.ok(files.includes(path.resolve(missingFile)), 'Should include missing file under shadow');
  });

  test('ignores files outside the shadow root', () => {
    const shadow = createTestShadow();
    const outsideOutput = `Error in /outside/system/other.ts:1:1: some error`;
    const files = parseImplicatedFiles(outsideOutput, shadow);

    assert.equal(files.length, 0);
  });
});
