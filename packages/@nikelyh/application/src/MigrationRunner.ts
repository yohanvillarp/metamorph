import { randomUUID } from 'crypto';
import { StateRepository, MigrationPlan, SemanticEventName, SemanticEventPayloads, PackageManagerType } from '@nikelyh/domain';
import { ShadowWorkspace, inspectManifest } from '@nikelyh/infrastructure';
import { Tool } from '@mozaik-ai/core';
import { bootstrapMetamorph } from './index';
import { sendEvent, resolveRuntime } from './runtime';

export interface MigrationRequest {
  targetPath: string;
  from: string;
  to: string;
  packageManager?: PackageManagerType;
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
  public readonly workspace: ShadowWorkspace;
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
    
    // Clean up old shadow workspaces to save disk space
    const existing = await this.store.getAllPlans();
    const protectedRunIds = existing.filter((p) => p.appliedAt).map((p) => p.runId);
    this.workspace.cleanupOldRuns(3, protectedRunIds);

    const runId = `run_${Date.now()}`;
    const shadowPath = this.workspace.cloneDirectory(request.targetPath, runId);

    const planId = `plan_${randomUUID()}`;
    const manifest = inspectManifest(request.targetPath);
    const resolvedPackageManager = request.packageManager || manifest.packageManager || 'npm';

    const plan: MigrationPlan = {
      id: planId,
      runId: runId,
      profile: { source: request.from, target: request.to },
      targetPath: request.targetPath,
      packageManager: resolvedPackageManager,
      phase: 'files',
      tasks: [
        { filePath: 'system:package_manager', status: 'pending' }
      ],
      createdAt: new Date(),
    };
    await this.store.savePlan(plan);

    const dispatcherId = resolveRuntime().state.dispatcherId;
    if (!dispatcherId) {
      throw new Error('Mozaik System participant is not joined.');
    }

    sendEvent(
      {
        type: SemanticEventName.MIGRATION_STARTED,
        producerId: dispatcherId,
        occurredAt: new Date(),
        payload: {
          planId,
          profile: plan.profile,
          shadowWorkspacePath: shadowPath,
          packageManager: resolvedPackageManager,
        } as SemanticEventPayloads.MigrationStarted,
      },
      dispatcherId
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
