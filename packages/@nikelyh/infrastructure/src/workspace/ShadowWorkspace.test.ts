import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { ShadowWorkspace } from './ShadowWorkspace';

describe('ShadowWorkspace.cleanupOldRuns', () => {
  const tmpDirs: string[] = [];

  function createBase(): string {
    const dir = path.join(os.tmpdir(), `metamorph-shadow-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(dir, { recursive: true });
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

  test('keeps the most recent unprotected runs and never deletes protected (applied) runIds', () => {
    const base = createBase();
    const workspace = new ShadowWorkspace(base);

    for (const id of ['run_1', 'run_2', 'run_3', 'run_4', 'run_applied']) {
      fs.mkdirSync(path.join(base, id), { recursive: true });
      fs.writeFileSync(path.join(base, id, 'marker.txt'), id);
    }

    workspace.cleanupOldRuns(2, ['run_applied']);

    assert.equal(fs.existsSync(path.join(base, 'run_applied')), true);
    assert.equal(fs.existsSync(path.join(base, 'run_1')), false);
    assert.equal(fs.existsSync(path.join(base, 'run_2')), false);
    assert.equal(fs.existsSync(path.join(base, 'run_3')), true);
    assert.equal(fs.existsSync(path.join(base, 'run_4')), true);
  });
});
