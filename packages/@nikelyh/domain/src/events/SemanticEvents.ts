import { MigrationProfile } from '../entities/MigrationProfile';

/**
 * Official names of the Semantic Events for the Mozaik Bus.
 * We use an enum to avoid typing errors when emitting/listening to events.
 */
export enum SemanticEventName {
  MIGRATION_STARTED = 'migration.started',
  FILE_DISCOVERED = 'file.discovered',
  FILE_MIGRATED = 'file.migrated',
  FILE_REVIEWED = 'file.reviewed',
  FILE_REJECTED = 'file.rejected',
  FILE_FATAL_MISMATCH = 'file.fatal_mismatch',
  FILE_FAILED = 'file.failed',
  PHASE_PACKAGES_READY = 'phase.packages_ready',
  PHASE_INTEGRATION_STARTED = 'phase.integration_started',
  MIGRATION_COMPLETED = 'migration.completed',
  SYSTEM_LOG = 'system.log',
}

/**
 * Exact payloads that accompany each event.
 * Ensures strong typing between emitting and listening agents.
 */
export namespace SemanticEventPayloads {
  export interface MigrationStarted {
    planId: string;
    profile: MigrationProfile;
    shadowWorkspacePath?: string;
  }

  export interface FileDiscovered {
    planId: string;
    filePath: string;
  }

  export interface FileMigrated {
    planId: string;
    filePath: string;
    /**
     * The diff or modified code for the Reviewer agent to evaluate.
     */
    diff: string;
  }

  export interface FileRejected {
    planId: string;
    filePath: string;
    /**
     * List of errors found (by linters, tests, or reviewers).
     */
    errors: string[];
    /**
     * Reviewer rejections share the Worker retry budget.
     * Integration rejections reset that budget so build failures can be repaired.
     */
    source?: 'reviewer' | 'integration';
  }

  export interface FileFatalMismatch {
    planId: string;
    filePath: string;
    /**
     * Explanation of why the architecture was fundamentally violated.
     */
    reason: string;
  }

  export interface FileFailed {
    planId: string;
    filePath: string;
    reason?: string;
  }

  export interface SystemLog {
    planId: string;
    message: string;
    level: 'info' | 'warning' | 'error';
  }
}
