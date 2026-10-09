import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MigrationPlan,
  MigrationCostSummary,
  StateRepository,
  TaskStatus,
  TokenUsageRecord,
  createEmptyMigrationCostSummary,
} from '@nikelyh/domain';
import { TokenAccountingService } from './TokenAccountingService';

class MockStateRepository implements StateRepository {
  public records: TokenUsageRecord[] = [];

  async savePlan(_plan: MigrationPlan): Promise<void> {}
  async getPlan(_id: string): Promise<MigrationPlan | null> {
    return {
      id: 'test-plan',
      runId: 'test-run-123',
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
    const summary = createEmptyMigrationCostSummary(runId, 'test-plan');
    for (const r of this.records.filter((rec) => rec.runId === runId)) {
      summary.totalTokens += r.totalTokens;
      summary.promptTokens += r.promptTokens;
      summary.completionTokens += r.completionTokens;
      summary.totalCostUsd += r.costUsd;
    }
    return summary;
  }

  async reset(): Promise<void> {
    this.records = [];
  }
}

describe('TokenAccountingService', () => {
  test('records usage with exact token counts and calculates cost', async () => {
    const repo = new MockStateRepository();
    const service = new TokenAccountingService(repo);

    const record = await service.recordUsage({
      planId: 'test-plan',
      agentRole: 'worker',
      modelId: 'gpt-5.4',
      tokenUsage: {
        promptTokens: 10000,
        completionTokens: 2000,
        totalTokens: 12000,
      },
    });

    assert.equal(record.runId, 'test-run-123');
    assert.equal(record.agentRole, 'worker');
    assert.equal(record.modelId, 'gpt-5.4');
    assert.equal(record.promptTokens, 10000);
    assert.equal(record.completionTokens, 2000);
    assert.equal(record.totalTokens, 12000);
    assert.equal(record.costUsd, 0.045);
    assert.equal(repo.records.length, 1);
  });

  test('falls back to character estimation when tokenUsage is absent', async () => {
    const repo = new MockStateRepository();
    const service = new TokenAccountingService(repo);

    const promptText = 'a'.repeat(400); // ~100 tokens
    const completionText = 'b'.repeat(200); // ~50 tokens

    const record = await service.recordUsage({
      planId: 'test-plan',
      agentRole: 'reviewer',
      modelId: 'gpt-5.4-mini',
      promptText,
      completionText,
    });

    assert.equal(record.promptTokens, 100);
    assert.equal(record.completionTokens, 50);
    assert.equal(record.totalTokens, 150);
    assert.ok(record.costUsd > 0);
  });
});
