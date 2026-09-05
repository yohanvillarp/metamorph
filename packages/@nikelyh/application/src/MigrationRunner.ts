import { randomUUID } from 'crypto';
import { StateRepository, MigrationPlan, SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';
import { ShadowWorkspace } from '@nikelyh/infrastructure';
import { Tool } from '@mozaik-ai/core';
import { bootstrapMetamorph } from './index';
import { sendEvent, join } from './runtime';

export interface MigrationRequest {
  targetPath: string;
  from: string;
  to: string;
}

export interface MigrationResult {
  planId: string;
  shadowPath: string;
  runId: string;
}

/**
 * MigrationRunner encapsulates the orchestration logic for starting
 * and rolling back migrations. It can be invoked from the CLI or 
 * from the REST API (Dashboard).
 */
export class MigrationRunner {
  private store: StateRepository;
  private tools: Tool[];
  private workspace: ShadowWorkspace;
  private initialized = false;

  constructor(store: StateRepository, tools: Tool[]) {
    this.store = store;
    this.tools = tools;
    this.workspace = new ShadowWorkspace();
  }

  /**
   * Bootstraps the Mozaik swarm if not already initialized.
   * Idempotent: safe to call multiple times.
   */
  private ensureInitialized() {
    if (!this.initialized) {
      bootstrapMetamorph(this.store, this.tools);
      this.initialized = true;
    }
  }

  /**
   * Starts a new migration run.
   * 1. Creates a Shadow Workspace copy of the target directory.
   * 2. Persists the MigrationPlan in the database.
   * 3. Emits MIGRATION_STARTED to wake the swarm.
   */
  async startMigration(request: MigrationRequest): Promise<MigrationResult> {
    this.ensureInitialized();
    await this.store.reset();
    
    // Clean up old shadow workspaces to save disk space
    this.workspace.cleanupOldRuns(3);

    const runId = `run_${Date.now()}`;
    const shadowPath = this.workspace.cloneDirectory(request.targetPath, runId);

    const planId = `plan_${randomUUID()}`;
    const plan: MigrationPlan = {
      id: planId,
      runId: runId,
      profile: { source: request.from, target: request.to },
      targetPath: request.targetPath,
      tasks: [],
      createdAt: new Date(),
    };
    await this.store.savePlan(plan);

    // Create a "Human" participant to dispatch the initial event
    const { createHuman } = await import('@mozaik-ai/core');
    const human = createHuman({ name: 'System', capabilities: [], handlers: [] });
    join(human);

    sendEvent(
      {
        type: SemanticEventName.MIGRATION_STARTED,
        producerId: human.getId(),
        occurredAt: new Date(),
        payload: {
          planId,
          profile: plan.profile,
          shadowWorkspacePath: shadowPath,
        } as SemanticEventPayloads.MigrationStarted,
      },
      human.getId()
    );

    return { planId, shadowPath, runId };
  }

  /**
   * Rolls back a migration by deleting its Shadow Workspace.
   * The original source code is never touched, so rollback
   * simply means discarding the shadow copy.
   */
  async rollbackMigration(runId: string): Promise<void> {
    this.workspace.rollback(runId);
  }
}
