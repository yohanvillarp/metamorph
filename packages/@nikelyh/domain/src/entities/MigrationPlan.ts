import { MigrationProfile } from './MigrationProfile';

/**
 * Possible statuses for a file task during the migration.
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Represents a unit of work (a single file) to be processed by a worker agent.
 */
export interface FileTask {
  /**
   * Relative or absolute path of the file to migrate.
   */
  filePath: string;

  /**
   * Current migration status of this file.
   */
  status: TaskStatus;

  /**
   * List of file paths this file depends on.
   * Useful for ensuring the migration order in the dependency graph.
   */
  dependencies?: string[];

  /**
   * Error message if the task failed (Linter, Tests, or agent error).
   */
  error?: string;
}

/**
 * The Migration Plan is the central "Blackboard".
 * It represents all discovered work and its global state.
 */
export interface MigrationPlan {
  /**
   * Unique ID of the migration session.
   */
  id: string;

  /**
   * The ID of the shadow workspace run.
   */
  runId: string;

  /**
   * The configured profile for this migration.
   */
  profile: MigrationProfile;

  /**
   * Original target directory path.
   */
  targetPath?: string;

  /**
   * List of file tasks to migrate.
   */
  tasks: FileTask[];

  /**
   * Creation date of the plan.
   */
  createdAt: Date;
}
