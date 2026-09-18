import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { MigrationIntegrator, isCopyIgnored } from './MigrationIntegrator';
import { ShadowWorkspace } from './ShadowWorkspace';

describe('MigrationIntegrator', () => {
  const tmpDirs: string[] = [];

  function createTmpDir(): string {
    const dir = path.join(os.tmpdir(), `metamorph-integ-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

  test('isCopyIgnored ignores build artifacts and sensitive env files', () => {
    assert.equal(isCopyIgnored('node_modules'), true);
    assert.equal(isCopyIgnored('.git'), true);
    assert.equal(isCopyIgnored('.next'), true);
    assert.equal(isCopyIgnored('.metamorph'), true);
    assert.equal(isCopyIgnored('.env'), true);
    assert.equal(isCopyIgnored('.env.local'), true);
    assert.equal(isCopyIgnored('.env.production'), true);
    assert.equal(isCopyIgnored('.env.development'), true);

    assert.equal(isCopyIgnored('package.json'), false);
    assert.equal(isCopyIgnored('src'), false);
    assert.equal(isCopyIgnored('App.tsx'), false);
  });

  test('resolveGitRoot correctly detects root and returns null when not in git', () => {
    const tmp = createTmpDir();
    const integrator = new MigrationIntegrator(new ShadowWorkspace(tmp));

    // Non-git directory
    assert.equal(integrator.resolveGitRoot(tmp), null);

    // Initialized git directory
    execFileSync('git', ['init'], { cwd: tmp, stdio: 'ignore' });
    const detected = integrator.resolveGitRoot(tmp);
    assert.ok(detected);
    assert.equal(path.resolve(detected), path.resolve(tmp));
  });

  test('isIgnoredByGit returns true for gitignored paths', () => {
    const tmp = createTmpDir();
    const integrator = new MigrationIntegrator(new ShadowWorkspace(tmp));

    execFileSync('git', ['init'], { cwd: tmp, stdio: 'ignore' });
    fs.writeFileSync(path.join(tmp, '.gitignore'), 'ignored-dir/\nsecret.txt\n');

    const ignoredPath = path.join(tmp, 'ignored-dir');
    fs.mkdirSync(ignoredPath, { recursive: true });
    assert.equal(integrator.isIgnoredByGit(tmp, ignoredPath), true);

    const normalPath = path.join(tmp, 'src');
    fs.mkdirSync(normalPath, { recursive: true });
    assert.equal(integrator.isIgnoredByGit(tmp, normalPath), false);
  });

  test('blocks apply when target is inside scratch/ in metamorph-monorepo', async () => {
    const tmp = createTmpDir();
    const shadowBase = path.join(tmp, '.metamorph', 'shadow');
    const integrator = new MigrationIntegrator(new ShadowWorkspace(shadowBase));

    // Simulate metamorph repo root
    execFileSync('git', ['init'], { cwd: tmp, stdio: 'ignore' });
    fs.writeFileSync(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'metamorph-monorepo', version: '1.0.0' })
    );

    const scratchApp = path.join(tmp, 'scratch', 'playgrounds', 'test-app');
    fs.mkdirSync(scratchApp, { recursive: true });

    // Create a dummy shadow run
    const runDir = path.join(shadowBase, 'run_test');
    fs.mkdirSync(runDir, { recursive: true });

    await assert.rejects(
      () => integrator.applyMigration('run_test', scratchApp),
      /BLOCKED: Cannot apply to .* because it is inside the development scratch\/ directory/
    );
  });
});
