import * as fs from 'node:fs';
import * as path from 'node:path';
import { Agent, createAgent } from '@mozaik-ai/core';
import {
  InferencePort,
  WorkerInferenceRequest,
  WorkerInferenceResponse,
  ReviewerInferenceRequest,
  ReviewerInferenceResponse,
} from '@nikelyh/domain';
import { assertSandbox } from '../tools/AstTools';

import {
  MockTransformRegistry,
  defaultMockTransformRegistry,
} from './strategies';

export interface MozaikLifecycleHook {
  join?: (agent: Agent) => void;
  leave?: (agent: Agent) => void;
}

/**
 * Offline, deterministic Mock Inference Adapter for Metamorph.
 * Simulates worker code transformation, reviewer verification, and token telemetry
 * with $0.00 cost and zero external LLM API credentials required.
 */
export class MockInferenceAdapter implements InferencePort {
  private lifecycle?: MozaikLifecycleHook;
  private registry: MockTransformRegistry;

  constructor(lifecycle?: MozaikLifecycleHook, registry?: MockTransformRegistry) {
    this.lifecycle = lifecycle;
    this.registry = registry || defaultMockTransformRegistry;
  }

  async runWorkerInference(request: WorkerInferenceRequest): Promise<WorkerInferenceResponse> {
    const tempAgent = createAgent({
      name: `Worker-Mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      capabilities: ['code_refactoring', 'inference'],
      instruction: 'Mock worker participant for deterministic offline transformation.',
      tools: [],
      handlers: [],
    });

    if (this.lifecycle?.join) {
      this.lifecycle.join(tempAgent);
    }

    try {
      const normalizedPath = path.resolve(request.filePath);
      if (request.shadowRoot) {
        assertSandbox(normalizedPath, request.shadowRoot);
      }

      if (!fs.existsSync(normalizedPath)) {
        return {
          success: false,
          error: `File not found on disk: ${request.filePath}`,
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }

      const originalContent = fs.readFileSync(normalizedPath, 'utf-8');
      const transformedContent = this.registry.transform({
        filePath: normalizedPath,
        sourceContent: originalContent,
        sourceFramework: request.sourceFramework,
        targetFramework: request.targetFramework,
        prompt: request.prompt,
      });

      fs.writeFileSync(normalizedPath, transformedContent, 'utf-8');

      const promptTokens = Math.max(120, Math.ceil(request.prompt.length / 4));
      const completionTokens = Math.max(45, Math.ceil(transformedContent.length / 4));
      const totalTokens = promptTokens + completionTokens;

      return {
        success: true,
        tokenUsage: { promptTokens, completionTokens, totalTokens },
        completionContent: transformedContent,
      };
    } finally {
      if (this.lifecycle?.leave) {
        this.lifecycle.leave(tempAgent);
      }
    }
  }

  async runReviewerInference(request: ReviewerInferenceRequest): Promise<ReviewerInferenceResponse> {
    const tempAgent = createAgent({
      name: `Reviewer-Mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      capabilities: ['code_review', 'inference'],
      instruction: 'Mock reviewer participant for deterministic offline review.',
      tools: [],
      handlers: [],
    });

    if (this.lifecycle?.join) {
      this.lifecycle.join(tempAgent);
    }

    try {
      const mockBehavior = process.env.METAMORPH_MOCK_BEHAVIOR || 'success';
      let status: 'APPROVED' | 'REJECTED' | 'FATAL_MISMATCH' = 'APPROVED';
      let errors: string[] = [];

      if (mockBehavior === 'exhaust_retries') {
        status = 'REJECTED';
        errors = ['Deterministic rejection simulated by MockInferenceAdapter (exhaust_retries)'];
      } else if (mockBehavior === 'fatal_mismatch') {
        status = 'FATAL_MISMATCH';
        errors = ['Deterministic fatal mismatch simulated by MockInferenceAdapter (fatal_mismatch)'];
      }

      const promptTokens = Math.max(80, Math.ceil(request.prompt.length / 4));
      const completionTokens = 35;
      const totalTokens = promptTokens + completionTokens;
      const rawAnswerText = JSON.stringify({ status, errors });

      return {
        status,
        errors,
        tokenUsage: { promptTokens, completionTokens, totalTokens },
        rawAnswerText,
      };
    } finally {
      if (this.lifecycle?.leave) {
        this.lifecycle.leave(tempAgent);
      }
    }
  }
}
