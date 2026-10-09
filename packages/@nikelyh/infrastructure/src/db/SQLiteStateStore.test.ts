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

  test('records token usage and calculates run cost summary accurately', async () => {
    const { store } = createTestStore();
    const runId = 'run-token-test-1';
    const planId = 'plan-token-test-1';

    await store.recordTokenUsage({
      runId,
      planId,
      agentRole: 'worker',
      modelId: 'gpt-5.4',
      promptTokens: 10000,
      completionTokens: 2000,
      totalTokens: 12000,
      costUsd: 0.045,
    });

    await store.recordTokenUsage({
      runId,
      planId,
      agentRole: 'reviewer',
      modelId: 'gpt-5.4',
      promptTokens: 5000,
      completionTokens: 1000,
      totalTokens: 6000,
      costUsd: 0.0225,
    });

    const summary = await store.getCostSummary(runId);

    assert.equal(summary.runId, runId);
    assert.equal(summary.planId, planId);
    assert.equal(summary.totalTokens, 18000);
    assert.equal(summary.promptTokens, 15000);
    assert.equal(summary.completionTokens, 3000);
    assert.equal(summary.totalCostUsd, 0.0675);

    assert.equal(summary.byAgentRole.worker.tokens, 12000);
    assert.equal(summary.byAgentRole.worker.executions, 1);
    assert.equal(summary.byAgentRole.reviewer.tokens, 6000);
    assert.equal(summary.byAgentRole.reviewer.executions, 1);

    assert.equal(summary.byModel['gpt-5.4'].totalTokens, 18000);
  });

  test('returns empty summary when runId has no token records', async () => {
    const { store } = createTestStore();
    const summary = await store.getCostSummary('non-existent-run');

    assert.equal(summary.totalTokens, 0);
    assert.equal(summary.totalCostUsd, 0);
    assert.equal(summary.byAgentRole.worker.tokens, 0);
  });
});
