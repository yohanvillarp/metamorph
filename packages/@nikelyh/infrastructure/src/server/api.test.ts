import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer } from './api';
import type { StateRepository } from '@nikelyh/domain';

const mockStore: StateRepository = {
  savePlan: async () => {},
  getPlan: async () => null,
  getAllPlans: async () => [],
  recordEvent: async () => {},
  getEvents: async () => [],
  recordCost: async () => {},
  getCostSummary: async () => ({
    runId: 'test',
    totalCostUsd: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    roleCosts: [],
    modelCosts: [],
  }),
} as unknown as StateRepository;

describe('API Server Catalogs Endpoint', () => {
  it('GET /api/catalogs/supported returns frameworks and migrations from domain', async () => {
    const app = await createApiServer(mockStore);
    const server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === 'string') {
      assert.fail('Failed to bind server address');
    }
    const port = address.port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/catalogs/supported`);
      assert.equal(res.status, 200);

      const data = (await res.json()) as {
        frameworks: Array<{ value: string; label: string; group: string }>;
        migrations: Record<string, string[]>;
      };

      assert.ok(Array.isArray(data.frameworks), 'frameworks should be an array');
      assert.ok(data.frameworks.length >= 9, 'should return at least 9 frameworks');
      assert.ok(data.migrations && typeof data.migrations === 'object', 'migrations should be an object');

      const hono = data.frameworks.find((f) => f.value === 'hono');
      assert.ok(hono, 'hono should be present in frameworks');
      assert.equal(hono.label, 'Hono');
      assert.equal(hono.group, 'backend');

      assert.ok(Array.isArray(data.migrations.hono));
      assert.ok(data.migrations.hono.includes('express'));
      assert.ok(data.migrations.react.includes('next'));
    } finally {
      server.close();
    }
  });
});
