import { test, describe, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Agent } from '@mozaik-ai/core';
import { MockInferenceAdapter } from './MockInferenceAdapter';
import { MozaikInferenceAdapter } from './MozaikInferenceAdapter';
import { InferenceFactory } from './InferenceFactory';

describe('MockInferenceAdapter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `metamorph-mock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    delete process.env.METAMORPH_MOCK;
    delete process.env.METAMORPH_MOCK_BEHAVIOR;
  });

  test('runWorkerInference transforms React component to Next.js with use client and synthetic tokens', async () => {
    const filePath = path.join(tmpDir, 'Counter.tsx');
    fs.writeFileSync(filePath, 'import React, { useState } from "react";\nexport function Counter() { const [count, setCount] = useState(0); return <button onClick={() => setCount(c => c+1)}>{count}</button>; }', 'utf-8');

    let joinedAgent: Agent | null = null;
    let leftAgent: Agent | null = null;

    const adapter = new MockInferenceAdapter({
      join: (agent) => { joinedAgent = agent; },
      leave: (agent) => { leftAgent = agent; },
    });

    const response = await adapter.runWorkerInference({
      planId: 'plan-1',
      filePath,
      prompt: 'Migrate to Next.js',
      modelId: 'mock',
      timeoutMs: 5000,
      shadowRoot: tmpDir,
      sourceFramework: 'react',
      targetFramework: 'next',
    });

    assert.equal(response.success, true);
    assert.ok(response.tokenUsage.totalTokens > 0);
    assert.equal(response.tokenUsage.totalTokens, response.tokenUsage.promptTokens + response.tokenUsage.completionTokens);

    const transformedContent = fs.readFileSync(filePath, 'utf-8');
    assert.ok(transformedContent.startsWith("'use client';"), 'Should prepend "use client" for client hooks');

    // Ephemeral participant lifecycle assertion
    assert.ok(joinedAgent, 'Should have joined ephemeral participant');
    assert.ok(leftAgent, 'Should have left ephemeral participant');
    assert.equal((joinedAgent as any).getId(), (leftAgent as any).getId());
  });

  test('runWorkerInference enforces sandbox boundary', async () => {
    const adapter = new MockInferenceAdapter();
    const outsidePath = path.resolve('/tmp/escape.tsx');

    await assert.rejects(async () => {
      await adapter.runWorkerInference({
        planId: 'plan-1',
        filePath: outsidePath,
        prompt: 'Migrate',
        modelId: 'mock',
        timeoutMs: 5000,
        shadowRoot: tmpDir,
      });
    }, /outside the sandbox/);
  });

  test('runReviewerInference deterministically approves in default success mode', async () => {
    let joined = false;
    let left = false;

    const adapter = new MockInferenceAdapter({
      join: () => { joined = true; },
      leave: () => { left = true; },
    });

    const response = await adapter.runReviewerInference({
      planId: 'plan-1',
      filePath: 'src/App.tsx',
      prompt: 'Review migration',
      diff: '+ "use client";',
      modelId: 'mock',
      timeoutMs: 5000,
    });

    assert.equal(response.status, 'APPROVED');
    assert.equal(response.errors.length, 0);
    assert.ok(response.tokenUsage.totalTokens > 0);
    assert.ok(response.rawAnswerText?.includes('APPROVED'));
    assert.equal(joined, true);
    assert.equal(left, true);
  });

  test('runReviewerInference simulates rejection when METAMORPH_MOCK_BEHAVIOR=exhaust_retries', async () => {
    process.env.METAMORPH_MOCK_BEHAVIOR = 'exhaust_retries';
    const adapter = new MockInferenceAdapter();

    const response = await adapter.runReviewerInference({
      planId: 'plan-1',
      filePath: 'src/App.tsx',
      prompt: 'Review migration',
      diff: '+ "use client";',
      modelId: 'mock',
      timeoutMs: 5000,
    });

    assert.equal(response.status, 'REJECTED');
    assert.ok(response.errors.length > 0);
  });

  test('InferenceFactory resolves MockInferenceAdapter when model is mock or mock flag is true', () => {
    const mockModelAdapter = InferenceFactory.create({ model: 'mock', concurrency: 3, inferenceTimeoutMs: 120000, maxRetries: 2, maxIntegrationRounds: 4, disabledAgents: [] });
    assert.ok(mockModelAdapter instanceof MockInferenceAdapter);

    const mockFlagAdapter = InferenceFactory.create({ model: 'gpt-5.4', mock: true, concurrency: 3, inferenceTimeoutMs: 120000, maxRetries: 2, maxIntegrationRounds: 4, disabledAgents: [] });
    assert.ok(mockFlagAdapter instanceof MockInferenceAdapter);

    process.env.METAMORPH_MOCK = 'true';
    const envAdapter = InferenceFactory.create({ model: 'gpt-5.4', concurrency: 3, inferenceTimeoutMs: 120000, maxRetries: 2, maxIntegrationRounds: 4, disabledAgents: [] });
    assert.ok(envAdapter instanceof MockInferenceAdapter);
  });

  test('InferenceFactory resolves MozaikInferenceAdapter when live model and hooks provided', () => {
    const dummyHooks = {
      join: () => {},
      leave: () => {},
      runLoop: () => {},
    };
    const liveAdapter = InferenceFactory.create(
      { model: 'gpt-5.4', concurrency: 3, inferenceTimeoutMs: 120000, maxRetries: 2, maxIntegrationRounds: 4, disabledAgents: [] },
      dummyHooks
    );
    assert.ok(liveAdapter instanceof MozaikInferenceAdapter);
  });
});
