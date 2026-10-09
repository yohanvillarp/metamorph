import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SemanticEventName, TokenUsageRecord, MigrationPlan, MigrationCostSummary, StateRepository, TaskStatus, createEmptyMigrationCostSummary } from '@nikelyh/domain';
import { initializeRuntime, MetamorphState } from '../runtime';
import { createAccountingAgent } from './AccountingAgent';

class MockStateRepository implements StateRepository {
  public records: TokenUsageRecord[] = [];

  async savePlan(_plan: MigrationPlan): Promise<void> {}
  async getPlan(id: string): Promise<MigrationPlan | null> {
    return {
      id,
      runId: 'test-run-accounting',
      profile: { source: 'react', target: 'next' },
      createdAt: new Date(),
      tasks: [],
    };
  }
  async getAllPlans(): Promise<MigrationPlan[]> { return []; }
  async updateTaskStatus(_planId: string, _filePath: string, _status: TaskStatus): Promise<void> {}
  async logEvent(_eventName: string, _payload: Record<string, unknown>): Promise<void> {}
  async getEvents(): Promise<any[]> { return []; }

  async recordTokenUsage(record: TokenUsageRecord): Promise<void> {
    this.records.push(record);
  }

  async getCostSummary(runId: string): Promise<MigrationCostSummary> {
    return createEmptyMigrationCostSummary(runId, 'plan-acc');
  }

  async reset(): Promise<void> {
    this.records = [];
  }
}

describe('AccountingAgent', () => {
  test('creates AccountingAgent and satisfies WhenTokensReportedSpecification', () => {
    const agent = createAccountingAgent();
    assert.ok(agent.getId());

    const handlers = agent.getHandlers();
    assert.equal(handlers.length, 1);

    const spec = handlers[0].specification;
    assert.equal(
      spec.isSatisfiedBy({
        event: {
          type: SemanticEventName.TOKENS_REPORTED,
          occurredAt: new Date(),
          producerId: 'Worker-1',
          payload: {},
        },
        participant: agent,
      } as any),
      true
    );

    assert.equal(
      spec.isSatisfiedBy({
        event: {
          type: SemanticEventName.FILE_MIGRATED,
          occurredAt: new Date(),
          producerId: 'Worker-1',
          payload: {},
        },
        participant: agent,
      } as any),
      false
    );
  });

  test('handler applies token accounting to repository on tokens.reported event', async () => {
    const repo = new MockStateRepository();
    initializeRuntime({ state: new MetamorphState(repo) });

    const agent = createAccountingAgent();
    const handler = agent.getHandlers()[0];

    await handler.processor.apply({
      event: {
        type: SemanticEventName.TOKENS_REPORTED,
        occurredAt: new Date(),
        producerId: 'Worker-Test',
        payload: {
          planId: 'plan-acc',
          agentRole: 'worker',
          modelId: 'gpt-5.4',
          tokenUsage: {
            promptTokens: 5000,
            completionTokens: 1000,
            totalTokens: 6000,
          },
        },
      },
      participant: agent,
    } as any);

    assert.equal(repo.records.length, 1);
    assert.equal(repo.records[0].planId, 'plan-acc');
    assert.equal(repo.records[0].agentRole, 'worker');
    assert.equal(repo.records[0].modelId, 'gpt-5.4');
    assert.equal(repo.records[0].promptTokens, 5000);
    assert.equal(repo.records[0].completionTokens, 1000);
    assert.ok(repo.records[0].costUsd > 0);
  });
});
