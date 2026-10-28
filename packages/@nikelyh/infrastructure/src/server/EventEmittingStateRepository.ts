import type { StateRepository, MigrationPlan, TaskStatus } from '@nikelyh/domain';
import type { MigrationEventStream } from './MigrationEventStream.js';

/**
 * StateRepository decorator that forwards every write to the wrapped store
 * and then broadcasts it on a MigrationEventStream. The application layer
 * receives this through the StateRepository port and stays unaware of SSE.
 *
 * Broadcasts happen only after the inner write resolves, so a client never
 * learns about state that failed to persist.
 */
export class EventEmittingStateRepository implements StateRepository {
  constructor(
    private readonly inner: StateRepository,
    private readonly stream: MigrationEventStream
  ) {}

  async savePlan(plan: MigrationPlan): Promise<void> {
    await this.inner.savePlan(plan);
    this.stream.broadcastPlanChange('saved', plan.id);
  }

  getPlan(id: string): Promise<MigrationPlan | null> {
    return this.inner.getPlan(id);
  }

  getAllPlans(): Promise<MigrationPlan[]> {
    return this.inner.getAllPlans();
  }

  async updateTaskStatus(planId: string, filePath: string, status: TaskStatus, error?: string): Promise<void> {
    await this.inner.updateTaskStatus(planId, filePath, status, error);
    this.stream.broadcastPlanChange('task', planId);
  }

  async logEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
    await this.inner.logEvent(eventName, payload);
    this.stream.broadcastEvent(eventName, payload);
  }

  getEvents(): ReturnType<StateRepository['getEvents']> {
    return this.inner.getEvents();
  }

  recordTokenUsage(record: Parameters<StateRepository['recordTokenUsage']>[0]): Promise<void> {
    return this.inner.recordTokenUsage(record);
  }

  getCostSummary(runId: string): ReturnType<StateRepository['getCostSummary']> {
    return this.inner.getCostSummary(runId);
  }

  async reset(): Promise<void> {
    await this.inner.reset();
    this.stream.broadcastPlanChange('reset');
  }
}
