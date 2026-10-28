import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { MigrationPlan, StateRepository } from '@nikelyh/domain';
import { EventEmittingStateRepository } from './EventEmittingStateRepository';
import type { MigrationEventStream } from './MigrationEventStream';

const samplePlan = { id: 'plan-1', runId: 'run-1' } as MigrationPlan;
const sampleEvents = [{ id: 1, eventName: 'migration.started', payload: {}, timestamp: new Date() }];
const sampleCost = { runId: 'run-1', planId: 'plan-1', totalTokens: 0 } as Awaited<ReturnType<StateRepository['getCostSummary']>>;
const sampleUsage = { runId: 'run-1', planId: 'plan-1', agentRole: 'worker' } as Parameters<StateRepository['recordTokenUsage']>[0];

function setup() {
  const inner = {
    savePlan: mock.fn(async () => {}),
    getPlan: mock.fn(async () => samplePlan),
    getAllPlans: mock.fn(async () => [samplePlan]),
    updateTaskStatus: mock.fn(async () => {}),
    logEvent: mock.fn(async () => {}),
    getEvents: mock.fn(async () => sampleEvents),
    recordTokenUsage: mock.fn(async () => {}),
    getCostSummary: mock.fn(async () => sampleCost),
    reset: mock.fn(async () => {}),
  };
  const stream = {
    broadcastEvent: mock.fn(),
    broadcastPlanChange: mock.fn(),
  };
  const store = new EventEmittingStateRepository(
    inner as unknown as StateRepository,
    stream as unknown as MigrationEventStream
  );
  return { inner, stream, store };
}

describe('EventEmittingStateRepository writes', () => {
  it('savePlan persists first, then broadcasts a "saved" plan change with the plan id', async () => {
    const { inner, stream, store } = setup();
    await store.savePlan(samplePlan);
    assert.deepEqual(inner.savePlan.mock.calls[0].arguments, [samplePlan]);
    assert.deepEqual(stream.broadcastPlanChange.mock.calls[0].arguments, ['saved', 'plan-1']);
    assert.equal(stream.broadcastEvent.mock.callCount(), 0);
  });

  it('updateTaskStatus forwards every argument, then broadcasts a "task" plan change', async () => {
    const { inner, stream, store } = setup();
    await store.updateTaskStatus('plan-1', 'src/a.ts', 'failed', 'boom');
    assert.deepEqual(inner.updateTaskStatus.mock.calls[0].arguments, ['plan-1', 'src/a.ts', 'failed', 'boom']);
    assert.deepEqual(stream.broadcastPlanChange.mock.calls[0].arguments, ['task', 'plan-1']);
  });

  it('logEvent persists first, then broadcasts the same name and payload', async () => {
    const { inner, stream, store } = setup();
    const payload = { filePath: 'src/a.ts' };
    await store.logEvent('worker.started', payload);
    assert.deepEqual(inner.logEvent.mock.calls[0].arguments, ['worker.started', payload]);
    assert.deepEqual(stream.broadcastEvent.mock.calls[0].arguments, ['worker.started', payload]);
    assert.equal(stream.broadcastPlanChange.mock.callCount(), 0);
  });

  it('reset clears the store, then broadcasts a "reset" plan change without a plan id', async () => {
    const { inner, stream, store } = setup();
    await store.reset();
    assert.equal(inner.reset.mock.callCount(), 1);
    assert.deepEqual(stream.broadcastPlanChange.mock.calls[0].arguments, ['reset']);
  });

  it('broadcasts only after the inner write resolves, in order', async () => {
    const order: string[] = [];
    const { inner, stream, store } = setup();
    inner.logEvent.mock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push('persisted');
    });
    stream.broadcastEvent.mock.mockImplementation(() => { order.push('broadcast'); });
    await store.logEvent('migration.started', {});
    assert.deepEqual(order, ['persisted', 'broadcast']);
  });

  it('does not broadcast when the inner write rejects', async () => {
    const failure = new Error('disk full');
    const { inner, stream, store } = setup();
    inner.savePlan.mock.mockImplementation(async () => { throw failure; });
    inner.logEvent.mock.mockImplementation(async () => { throw failure; });
    await assert.rejects(() => store.savePlan(samplePlan), failure);
    await assert.rejects(() => store.logEvent('x', {}), failure);
    assert.equal(stream.broadcastPlanChange.mock.callCount(), 0);
    assert.equal(stream.broadcastEvent.mock.callCount(), 0);
  });
});

describe('EventEmittingStateRepository reads', () => {
  it('passes reads and token accounting straight through without broadcasting', async () => {
    const { inner, stream, store } = setup();

    assert.equal(await store.getPlan('plan-1'), samplePlan);
    assert.deepEqual(inner.getPlan.mock.calls[0].arguments, ['plan-1']);
    assert.deepEqual(await store.getAllPlans(), [samplePlan]);
    assert.equal(await store.getEvents(), sampleEvents);
    assert.equal(await store.getCostSummary('run-1'), sampleCost);
    assert.deepEqual(inner.getCostSummary.mock.calls[0].arguments, ['run-1']);
    await store.recordTokenUsage(sampleUsage);
    assert.deepEqual(inner.recordTokenUsage.mock.calls[0].arguments, [sampleUsage]);

    assert.equal(stream.broadcastEvent.mock.callCount(), 0);
    assert.equal(stream.broadcastPlanChange.mock.callCount(), 0);
  });
});
