import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  MigrationPlan,
  StateRepository,
  TaskStatus,
} from '@nikelyh/domain';

interface PlanRow {
  id: string;
  run_id: string;
  target_path: string;
  source_framework: string;
  target_framework: string;
  rules_json: string;
  created_at: string;
}

interface TaskRow {
  plan_id: string;
  file_path: string;
  status: string;
  dependencies_json: string;
  error: string | null;
}

interface EventRow {
  id: number;
  event_name: string;
  payload_json: string;
  timestamp: string;
}

/**
 * Implementation of StateRepository using Node.js built-in node:sqlite.
 * This runs locally on the user's machine to persist the Event Bus and Migration State.
 */
export class SQLiteStateStore implements StateRepository {
  private db: DatabaseSync;

  constructor(storageDir: string = '.metamorph') {
    // Ensure the hidden directory exists
    try {
      mkdirSync(storageDir, { recursive: true });
    } catch (e) {
      // Ignore if it already exists
    }

    const dbPath = join(storageDir, 'history.db');
    this.db = new DatabaseSync(dbPath);
    this.initTables();
  }

  /**
   * Creates the necessary tables if they do not exist.
   */
  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        run_id TEXT,
        target_path TEXT,
        source_framework TEXT,
        target_framework TEXT,
        rules_json TEXT,
        created_at TEXT
      );
    `);
    
    // Auto-migrate schema if columns are missing
    try { this.db.exec('ALTER TABLE plans ADD COLUMN run_id TEXT'); } catch (e) {}
    try { this.db.exec('ALTER TABLE plans ADD COLUMN target_path TEXT'); } catch (e) {}

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        plan_id TEXT,
        file_path TEXT,
        status TEXT,
        dependencies_json TEXT,
        error TEXT,
        PRIMARY KEY (plan_id, file_path),
        FOREIGN KEY (plan_id) REFERENCES plans(id)
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT,
        payload_json TEXT,
        timestamp TEXT
      );
    `);
  }

  async savePlan(plan: MigrationPlan): Promise<void> {
    const stmtPlan = this.db.prepare(`
      INSERT OR REPLACE INTO plans (id, run_id, target_path, source_framework, target_framework, rules_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmtPlan.run(
      plan.id,
      plan.runId,
      plan.targetPath || '',
      plan.profile.source,
      plan.profile.target,
      JSON.stringify(plan.profile.rules || []),
      plan.createdAt.toISOString()
    );

    const stmtTask = this.db.prepare(`
      INSERT OR REPLACE INTO tasks (plan_id, file_path, status, dependencies_json, error)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const task of plan.tasks) {
      stmtTask.run(
        plan.id,
        task.filePath,
        task.status,
        JSON.stringify(task.dependencies || []),
        task.error || null
      );
    }
  }

  async getPlan(id: string): Promise<MigrationPlan | null> {
    const stmtPlan = this.db.prepare(`SELECT * FROM plans WHERE id = ?`);
    const planRow = stmtPlan.get(id) as unknown as PlanRow | undefined;

    if (!planRow) {
      return null;
    }

    const stmtTasks = this.db.prepare(`SELECT * FROM tasks WHERE plan_id = ?`);
    const taskRows = stmtTasks.all(id) as unknown as TaskRow[];

    return {
      id: planRow.id,
      runId: planRow.run_id,
      targetPath: planRow.target_path,
      profile: {
        source: planRow.source_framework,
        target: planRow.target_framework,
        rules: JSON.parse(planRow.rules_json),
      },
      createdAt: new Date(planRow.created_at),
      tasks: taskRows.map((row) => ({
        filePath: row.file_path,
        status: row.status as TaskStatus,
        dependencies: JSON.parse(row.dependencies_json),
        error: row.error || undefined,
      })),
    };
  }

  async updateTaskStatus(
    planId: string,
    filePath: string,
    status: TaskStatus,
    error?: string
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (plan_id, file_path, status, error, dependencies_json)
      VALUES (?, ?, ?, ?, '[]')
      ON CONFLICT(plan_id, file_path) DO UPDATE 
      SET status = excluded.status, error = excluded.error
    `);
    stmt.run(planId, filePath, status, error || null);
  }

  async logEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO events (event_name, payload_json, timestamp)
      VALUES (?, ?, ?)
    `);
    stmt.run(eventName, JSON.stringify(payload), new Date().toISOString());
  }

  async getAllPlans(): Promise<MigrationPlan[]> {
    const stmtPlans = this.db.prepare(`SELECT * FROM plans ORDER BY created_at DESC`);
    const planRows = stmtPlans.all() as unknown as PlanRow[];

    const stmtTasks = this.db.prepare(`SELECT * FROM tasks`);
    const taskRows = stmtTasks.all() as unknown as TaskRow[];

    return planRows.map((planRow) => {
      const planTasks = taskRows.filter((t) => t.plan_id === planRow.id);
      return {
        id: planRow.id,
        runId: planRow.run_id,
        targetPath: planRow.target_path,
        profile: {
          source: planRow.source_framework,
          target: planRow.target_framework,
          rules: JSON.parse(planRow.rules_json),
        },
        createdAt: new Date(planRow.created_at),
        tasks: planTasks.map((row) => ({
          filePath: row.file_path,
          status: row.status as TaskStatus,
          dependencies: JSON.parse(row.dependencies_json),
          error: row.error || undefined,
        })),
      };
    });
  }

  async getEvents(): Promise<Array<{ id: number; eventName: string; payload: Record<string, unknown>; timestamp: Date }>> {
    const stmt = this.db.prepare(`SELECT * FROM events ORDER BY id DESC LIMIT 100`);
    const rows = stmt.all() as unknown as EventRow[];
    return rows.map((row) => ({
      id: row.id,
      eventName: row.event_name,
      payload: JSON.parse(row.payload_json),
      timestamp: new Date(row.timestamp),
    }));
  }

  async reset(): Promise<void> {
    this.db.exec(`DELETE FROM tasks`);
    this.db.exec(`DELETE FROM plans`);
    this.db.exec(`DELETE FROM events`);
  }
}
