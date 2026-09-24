import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SQLiteStateStore } from './SQLiteStateStore';
import { MigrationPlan } from '@nikelyh/domain';

describe('SQLiteStateStore', () => {
  const tmpDirs: string[] = [];

  function createTestStore(): { store: SQLiteStateStore; dir: string } {
    const tmpDir = path.join(os.tmpdir(), `metamorph-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    tmpDirs.push(tmpDir);
    return { store: new SQLiteStateStore(tmpDir), dir: tmpDir };
  }

  afterEach(() => {
    for (const dir of tmpDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
    tmpDirs.length = 0;
  });

  test('saves and retrieves plan with outcome = success', async () => {
    const { store } = createTestStore();
    const plan: MigrationPlan = {
      id: 'plan-success',
      runId: 'run-1',
      targetPath: './src',
      profile: { source: 'react', target: 'next' },
      createdAt: new Date(),
      phase: 'completed',
      outcome: 'success',
      tasks: [
        { filePath: 'src/App.tsx', status: 'completed' }
      ]
    };

    await store.savePlan(plan);
    const retrieved = await store.getPlan('plan-success');

    assert.ok(retrieved);
    assert.equal(retrieved.id, 'plan-success');
    assert.equal(retrieved.phase, 'completed');
    assert.equal(retrieved.outcome, 'success');
  });

  test('saves and retrieves plan with outcome = failed', async () => {
    const { store } = createTestStore();
    const plan: MigrationPlan = {
      id: 'plan-fail',
      runId: 'run-2',
      targetPath: './src',
      profile: { source: 'react', target: 'next' },
      createdAt: new Date(),
      phase: 'failed',
      outcome: 'failed',
      tasks: [
        { filePath: 'src/App.tsx', status: 'failed', error: 'build error' }
      ]
    };

    await store.savePlan(plan);
    const retrieved = await store.getPlan('plan-fail');

    assert.ok(retrieved);
    assert.equal(retrieved.id, 'plan-fail');
    assert.equal(retrieved.phase, 'failed');
    assert.equal(retrieved.outcome, 'failed');
  });

  test('multiple plans coexist without erasing each other', async () => {
    const { store } = createTestStore();
    const plan1: MigrationPlan = {
      id: 'plan-1',
      runId: 'run-1',
      profile: { source: 'express', target: 'fastify' },
      createdAt: new Date(),
      phase: 'completed',
      outcome: 'success',
      tasks: [],
    };
    const plan2: MigrationPlan = {
      id: 'plan-2',
      runId: 'run-2',
      profile: { source: 'react', target: 'next' },
      createdAt: new Date(),
      phase: 'files',
      tasks: [],
    };

    await store.savePlan(plan1);
    await store.savePlan(plan2);

    const all = await store.getAllPlans();
    assert.equal(all.length, 2);
    assert.ok(all.some(p => p.id === 'plan-1' && p.outcome === 'success'));
    assert.ok(all.some(p => p.id === 'plan-2' && p.outcome === undefined));
  });

  test('saves and retrieves plan with custom packageManager (pnpm, bun, yarn)', async () => {
    const { store } = createTestStore();
    const plan: MigrationPlan = {
      id: 'plan-pnpm',
      runId: 'run-pnpm',
      targetPath: './packages/web',
      packageManager: 'pnpm',
      profile: { source: 'react', target: 'next' },
      createdAt: new Date(),
      phase: 'files',
      tasks: [],
    };

    await store.savePlan(plan);
    const retrieved = await store.getPlan('plan-pnpm');

    assert.ok(retrieved);
    assert.equal(retrieved.packageManager, 'pnpm');
  });

  test('defaults packageManager to npm when omitted', async () => {
    const { store } = createTestStore();
    const plan: MigrationPlan = {
      id: 'plan-legacy',
      runId: 'run-legacy',
      profile: { source: 'express', target: 'fastify' },
      createdAt: new Date(),
      phase: 'files',
      tasks: [],
    };

    await store.savePlan(plan);
    const retrieved = await store.getPlan('plan-legacy');

    assert.ok(retrieved);
    assert.equal(retrieved.packageManager, 'npm');
  });
});
