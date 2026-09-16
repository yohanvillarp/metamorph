import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { assertSandbox } from './AstTools';

describe('AstTools - assertSandbox', () => {
  const sandbox = path.resolve('/tmp/metamorph-sandbox/run-1');

  test('allows files directly inside sandbox', () => {
    const target = path.join(sandbox, 'src', 'App.tsx');
    const result = assertSandbox(target, sandbox);
    assert.equal(result, path.resolve(target));
  });

  test('allows the sandbox root itself', () => {
    const result = assertSandbox(sandbox, sandbox);
    assert.equal(result, sandbox);
  });

  test('throws if path is completely outside sandbox', () => {
    const outside = path.resolve('/tmp/metamorph-sandbox/other-dir/file.ts');
    assert.throws(
      () => assertSandbox(outside, sandbox),
      /BLOCKED: Path .* is outside the sandbox/
    );
  });

  test('prevents prefix collision bypass on sibling directory', () => {
    // Sibling directory with identical prefix but different folder name
    const siblingDir = sandbox + '-malicious';
    const evilPath = path.join(siblingDir, 'secret.ts');
    assert.throws(
      () => assertSandbox(evilPath, sandbox),
      /BLOCKED: Path .* is outside the sandbox/
    );
  });

  test('returns resolved path when sandboxDir is omitted', () => {
    const relative = 'src/test.ts';
    const result = assertSandbox(relative);
    assert.equal(result, path.resolve(relative));
  });

  test('createShadowTools returns all 6 standard file tools', async () => {
    const { createShadowTools } = await import('./AstTools');
    const tools = createShadowTools(sandbox);
    assert.equal(tools.length, 6);
    const names = tools.map((t) => t.name);
    assert.ok(names.includes('read_file'));
    assert.ok(names.includes('write_file'));
    assert.ok(names.includes('rename_file'));
    assert.ok(names.includes('create_file'));
    assert.ok(names.includes('delete_file'));
    assert.ok(names.includes('list_directory'));
  });
});
