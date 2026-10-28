import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer } from './api';
import { MigrationEventStream } from './MigrationEventStream';
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

describe('API Server SSE Stream Endpoint', () => {
  it('GET /api/events/stream keeps the connection open and relays broadcasts', async () => {
    const stream = new MigrationEventStream();
    const app = await createApiServer(mockStore, undefined, stream);
    const server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === 'string') {
      assert.fail('Failed to bind server address');
    }
    const controller = new AbortController();
    const decoder = new TextDecoder();

    try {
      const res = await fetch(`http://127.0.0.1:${address.port}/api/events/stream`, { signal: controller.signal });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/event-stream');
      assert.equal(res.headers.get('cache-control'), 'no-cache, no-transform');
      assert.equal(stream.clientCount, 1);

      const reader = res.body!.getReader();
      const first = decoder.decode((await reader.read()).value);
      assert.equal(first, 'retry: 3000\n\n');

      stream.broadcastEvent('worker.started', { filePath: 'src/a.ts' });
      const second = decoder.decode((await reader.read()).value);
      assert.match(second, /^event: migration\ndata: /);
      assert.deepEqual(JSON.parse(second.split('data: ')[1]).payload, { filePath: 'src/a.ts' });

      controller.abort();
      for (let i = 0; i < 50 && stream.clientCount > 0; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(stream.clientCount, 0);
    } finally {
      controller.abort();
      stream.close();
      server.close();
    }
  });
});
