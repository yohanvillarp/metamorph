import { MigrationPlan, TaskStatus } from '../entities/MigrationPlan';

/**
 * Secondary Port:
 * Interface that defines how the application state should be persisted.
 * The Infrastructure layer (SQLite) is obligated to implement this interface.
 */
export interface StateRepository {
  /**
   * Saves a migration plan for the first time (or overwrites it).
   */
  savePlan(plan: MigrationPlan): Promise<void>;

  /**
   * Retrieves a previously saved migration plan by its ID.
   */
  getPlan(id: string): Promise<MigrationPlan | null>;

  /**
   * Retrieves all saved migration plans.
   */
  getAllPlans(): Promise<MigrationPlan[]>;

  /**
   * Updates the status of a specific task (file) within a plan.
   */
  updateTaskStatus(planId: string, filePath: string, status: TaskStatus, error?: string): Promise<void>;

  /**
   * Saves a semantic event into the persistent history.
   * Vital for drawing timelines in the Web dashboard.
   */
  logEvent(eventName: string, payload: any): Promise<void>;

  /**
   * Retrieves all logged events.
   */
  getEvents(): Promise<any[]>;
}
