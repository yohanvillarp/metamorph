import type {
  MigrationPlan,
  MigrationEventItem,
  MigrationCostSummary,
  StartMigrationResponse,
  ApplyMigrationResponse,
} from './types';

const API_BASE = '';

export class DashboardApiClient {
  async getPlans(): Promise<MigrationPlan[]> {
    const res = await fetch(`${API_BASE}/api/plans`);
    if (!res.ok) throw new Error(`Failed to fetch plans: ${res.statusText}`);
    return res.json();
  }

  async getEvents(): Promise<MigrationEventItem[]> {
    const res = await fetch(`${API_BASE}/api/events`);
    if (!res.ok) throw new Error(`Failed to fetch events: ${res.statusText}`);
    return res.json();
  }

  async getCostSummary(runId: string): Promise<MigrationCostSummary | null> {
    if (!runId) return null;
    const res = await fetch(`${API_BASE}/api/cost/${encodeURIComponent(runId)}`);
    if (!res.ok) return null;
    return res.json();
  }

  async resetMigration(): Promise<void> {
    const res = await fetch(`${API_BASE}/api/migrations/reset`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to reset migration: ${res.statusText}`);
  }

  async startMigration(params: { targetPath: string; from: string; to: string }): Promise<StartMigrationResponse> {
    const res = await fetch(`${API_BASE}/api/migrations/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Failed to start migration');
    }
    return res.json();
  }

  async applyMigration(runId: string, targetPath: string): Promise<ApplyMigrationResponse> {
    const res = await fetch(`${API_BASE}/api/migrations/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, targetPath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Failed to apply migration');
    }
    return res.json();
  }
}

export const apiClient = new DashboardApiClient();
