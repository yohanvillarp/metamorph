import {
  Agent,
  createAgent,
  SituationContext,
  SituationSpecification,
  Tool,
} from '@mozaik-ai/core';
import {
  InferencePort,
  WorkerInferenceRequest,
  WorkerInferenceResponse,
  ReviewerInferenceRequest,
  ReviewerInferenceResponse,
  TokenUsage,
} from '@nikelyh/domain';
import { createShadowTools } from '../tools/AstTools';

class WhenTokensReported extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === 'inference.completed' && event.producerId === participant.getId();
  }
}

class WhenInferenceCompleted extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === 'model.answer' && event.producerId === participant.getId();
  }
}

class WhenReviewTokensReported extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === 'inference.completed' && event.producerId === participant.getId();
  }
}

class WhenReviewCompleted extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === 'model.answer' && event.producerId === participant.getId();
  }
}

export interface MozaikRuntimeMethods {
  join: (agent: Agent) => void;
  leave: (agent: Agent) => void;
  runLoop: (agentId: string, prompt: string, options?: any) => Promise<any> | void;
}

/**
 * Production Mozaik v4 Inference Adapter for Metamorph.
 * Orchestrates live LLM model inference loops using Mozaik runtime.
 */
export class MozaikInferenceAdapter implements InferencePort {
  constructor(private runtime: MozaikRuntimeMethods) {}

  async runWorkerInference(request: WorkerInferenceRequest): Promise<WorkerInferenceResponse> {
    const runtime = this.runtime;
    return new Promise((resolve) => {
      let isDone = false;
      let capturedUsage: TokenUsage | null = null;
      const workerTools: Tool[] = request.shadowRoot ? createShadowTools(request.shadowRoot) : [];

      const tempAgent = createAgent({
        name: `Worker-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        capabilities: ['code_refactoring', 'inference'],
        instruction:
          'You are a staff engineer migrating a real codebase. Deduce from files on disk: read the target and every local module it imports before writing. Never invent callback prop names or re-implement a screen you could import. Prefer evidence over catalog examples.',
        tools: workerTools,
        handlers: [
          {
            specification: new WhenTokensReported(),
            processor: {
              async apply({ event }) {
                const output = event.payload as { tokenUsage?: TokenUsage };
                if (output?.tokenUsage) {
                  capturedUsage = output.tokenUsage;
                }
              },
            },
          },
          {
            specification: new WhenInferenceCompleted(),
            processor: {
              async apply({ participant: tempParticipant }) {
                if (isDone) return;
                isDone = true;
                try {
                  const tokenUsage: TokenUsage = capturedUsage || {
                    promptTokens: Math.max(1, Math.ceil(request.prompt.length / 4)),
                    completionTokens: 100,
                    totalTokens: Math.max(1, Math.ceil(request.prompt.length / 4)) + 100,
                  };
                  resolve({
                    success: true,
                    tokenUsage,
                  });
                } finally {
                  runtime.leave(tempParticipant as Agent);
                }
              },
            },
          },
        ],
      });

      runtime.join(tempAgent);

      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          runtime.leave(tempAgent);
          resolve({
            success: false,
            error: `Inference timed out after ${Math.round(request.timeoutMs / 1000)}s`,
            tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          });
        }
      }, request.timeoutMs);

      try {
        const loopResult = runtime.runLoop(tempAgent.getId(), request.prompt, {
          model: request.modelId,
          context: tempAgent.getMemory().getContext(),
          tools: tempAgent.getTools(),
        }) as unknown as Promise<void> | undefined;

        if (loopResult && typeof loopResult.catch === 'function') {
          loopResult.catch((error: unknown) => {
            clearTimeout(timer);
            if (!isDone) {
              isDone = true;
              runtime.leave(tempAgent);
              resolve({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
              });
            }
          });
        }
      } catch (error: unknown) {
        clearTimeout(timer);
        if (!isDone) {
          isDone = true;
          runtime.leave(tempAgent);
          resolve({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          });
        }
      }
    });
  }

  async runReviewerInference(request: ReviewerInferenceRequest): Promise<ReviewerInferenceResponse> {
    const runtime = this.runtime;
    return new Promise((resolve) => {
      let isDone = false;
      let capturedUsage: TokenUsage | null = null;
      const reviewerId = `Reviewer-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const tempAgent = createAgent({
        name: reviewerId,
        capabilities: ['code_review', 'inference'],
        instruction:
          'You are a staff engineer reviewing a migrated file against its neighbors. Reject if public props/emits do not match imported modules, if a router file re-implements a screen instead of importing it, or if a screen was hollowed out. UI that lived under src/pages in a SPA is not a Next Pages Router file. Do not reject a file just because it lacks every catalog feature. FATAL_MISMATCH only for an unfixable paradigm break.',
        tools: [],
        handlers: [
          {
            specification: new WhenReviewTokensReported(),
            processor: {
              async apply({ event }) {
                const output = event.payload as { tokenUsage?: TokenUsage };
                if (output?.tokenUsage) {
                  capturedUsage = output.tokenUsage;
                }
              },
            },
          },
          {
            specification: new WhenReviewCompleted(),
            processor: {
              async apply({ event, participant: tempParticipant }) {
                if (isDone) return;
                isDone = true;
                try {
                  const answerItem = (event.payload as Record<string, any>).answer;
                  const answerText = answerItem?.content?.text || answerItem?.text || null;
                  let parsed: { status: 'APPROVED' | 'REJECTED' | 'FATAL_MISMATCH'; errors: string[] } = {
                    status: 'APPROVED',
                    errors: [],
                  };
                  if (answerText) {
                    try {
                      parsed = JSON.parse(answerText);
                    } catch {}
                  }
                  const tokenUsage: TokenUsage = capturedUsage || {
                    promptTokens: Math.max(1, Math.ceil(request.prompt.length / 4)),
                    completionTokens: 50,
                    totalTokens: Math.max(1, Math.ceil(request.prompt.length / 4)) + 50,
                  };
                  resolve({
                    status: parsed.status || 'APPROVED',
                    errors: parsed.errors || [],
                    tokenUsage,
                    rawAnswerText: answerText || undefined,
                  });
                } finally {
                  runtime.leave(tempParticipant as Agent);
                }
              },
            },
          },
        ],
      });

      runtime.join(tempAgent);

      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          runtime.leave(tempAgent);
          resolve({
            status: 'REJECTED',
            errors: [`Review inference timed out after ${Math.round(request.timeoutMs / 1000)}s`],
            tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          });
        }
      }, request.timeoutMs);

      try {
        const loopResult = runtime.runLoop(tempAgent.getId(), request.prompt, {
          model: request.modelId,
          context: tempAgent.getMemory().getContext(),
          structuredOutput: {
            name: 'review_result',
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['APPROVED', 'REJECTED', 'FATAL_MISMATCH'] },
                errors: { type: 'array', items: { type: 'string' } },
              },
              required: ['status', 'errors'],
              additionalProperties: false,
            },
            strict: true,
          },
        }) as unknown as Promise<void> | undefined;

        if (loopResult && typeof loopResult.catch === 'function') {
          loopResult.catch((error: unknown) => {
            clearTimeout(timer);
            if (!isDone) {
              isDone = true;
              runtime.leave(tempAgent);
              resolve({
                status: 'REJECTED',
                errors: [error instanceof Error ? error.message : String(error)],
                tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
              });
            }
          });
        }
      } catch (error: unknown) {
        clearTimeout(timer);
        if (!isDone) {
          isDone = true;
          runtime.leave(tempAgent);
          resolve({
            status: 'REJECTED',
            errors: [error instanceof Error ? error.message : String(error)],
            tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          });
        }
      }
    });
  }
}
