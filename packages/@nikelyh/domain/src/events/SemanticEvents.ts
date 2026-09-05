import { MigrationProfile } from '../entities/MigrationProfile';

/**
 * Official names of the Semantic Events for the Mozaik Bus.
 * We use an enum to avoid typing errors when emitting/listening to events.
 */
export enum SemanticEventName {
  MIGRATION_STARTED = 'migration.started',
  FILE_DISCOVERED = 'file.discovered',
  FILE_MIGRATED = 'file.migrated',
  FILE_REJECTED = 'file.rejected',
  MIGRATION_COMPLETED = 'migration.completed',
}

/**
 * Exact payloads that accompany each event.
 * Ensures strong typing between emitting and listening agents.
 */
export namespace SemanticEventPayloads {
  export interface MigrationStarted {
    planId: string;
    profile: MigrationProfile;
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
  }
}
