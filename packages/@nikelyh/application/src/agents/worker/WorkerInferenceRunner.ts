import { Agent, createAgent as createMozaikAgent, SituationContext, SituationSpecification, Tool } from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads, TokenUsage } from '@nikelyh/domain';
import * as fs from 'fs';
import { join, leave, resolveRuntime, runLoop, sendEvent } from '../../runtime';
import { findShadowRoot } from '../../analysis/NextMigrationHints';
import { MISSING_AFTER_WORKER, workerCompletionKind } from '../../analysis/workerCompletion';

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

async function resolveWorkerTools(participant: Agent, filePath: string): Promise<Tool[]> {
  const shadowRoot = findShadowRoot(filePath);
  if (!shadowRoot) return participant.getTools();
  const { createShadowTools } = await import('@nikelyh/infrastructure');
  return createShadowTools(shadowRoot);
}

async function handleCompletedInference(params: {
  tempParticipant: { getId(): string };
  filePath: string;
  planId: string;
}): Promise<void> {
  const { tempParticipant, filePath, planId } = params;
  const runtime = resolveRuntime();
  const repository = runtime.state.repository;

  const exists = fs.existsSync(filePath);
  if (workerCompletionKind(exists) === 'failed_missing') {
    console.warn(`[WorkerAgent:${tempParticipant.getId()}] File not found on disk after inference: ${filePath}`);
    await repository.updateTaskStatus(planId, filePath, 'failed', MISSING_AFTER_WORKER);
    sendEvent({
      type: SemanticEventName.FILE_FAILED,
      producerId: tempParticipant.getId(),
      occurredAt: new Date(),
      payload: { planId, filePath, reason: MISSING_AFTER_WORKER },
    }, tempParticipant.getId());
    return;
  }

  let fileContent = '';
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`[WorkerAgent:${tempParticipant.getId()}] Read ${fileContent.length} chars from ${filePath}`);
  } catch (e) {
    console.error(`[WorkerAgent:${tempParticipant.getId()}] Error reading file:`, e);
  }

  console.log(`[WorkerAgent:${tempParticipant.getId()}] Inference completed. Emitting FILE_MIGRATED.`);
  await repository.updateTaskStatus(planId, filePath, 'in_progress');

  sendEvent({
    type: SemanticEventName.FILE_MIGRATED,
    producerId: tempParticipant.getId(),
    occurredAt: new Date(),
    payload: {
      planId,
      filePath,
      diff: fileContent,
    } as SemanticEventPayloads.FileMigrated,
  }, tempParticipant.getId());
}

export async function startWorkerLoop(
  planId: string,
  filePath: string,
  prompt: string,
  participant: Agent
): Promise<void> {
  return new Promise(async (originalResolve) => {
    let isDone = false;
    const resolve = () => {
      if (!isDone) {
        isDone = true;
        originalResolve();
      }
    };

    const runtime = resolveRuntime();
    const repository = runtime.state.repository;
    await repository.updateTaskStatus(planId, filePath, 'in_progress');

    const config = runtime.state.config;
    const modelToUse = config?.model || process.env.METAMORPH_MODEL || 'gpt-5.4';
    const timeoutMs = config?.inferenceTimeoutMs || 120000;

    let capturedUsage: TokenUsage | null = null;
    const workerTools = await resolveWorkerTools(participant, filePath);
    const tempAgent = createMozaikAgent({
      name: `Worker-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      capabilities: ['code_refactoring', 'inference'],
      instruction: 'You are a staff engineer migrating a real codebase. Deduce from files on disk: read the target and every local module it imports before writing. Never invent callback prop names or re-implement a screen you could import. Prefer evidence over catalog examples.',
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
              try {
                await handleCompletedInference({ tempParticipant, filePath, planId });
                sendEvent({
                  type: SemanticEventName.TOKENS_REPORTED,
                  producerId: tempParticipant.getId(),
                  occurredAt: new Date(),
                  payload: {
                    planId,
                    agentRole: 'worker',
                    modelId: modelToUse,
                    tokenUsage: capturedUsage,
                    promptText: prompt,
                    completionText: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '',
                  } as SemanticEventPayloads.TokensReported,
                }, tempParticipant.getId());
              } catch (e) {
                console.error(`[WorkerAgent:${tempParticipant.getId()}] Error completing inference:`, e);
              } finally {
                leave(tempParticipant);
                resolve();
              }
            },
          },
        },
      ],
    });

    join(tempAgent);

    const timer = setTimeout(async () => {
      if (!isDone) {
        console.error(`[WorkerAgent:${tempAgent.getId()}] Inference timed out after ${Math.round(timeoutMs / 1000)}s.`);
        await repository.updateTaskStatus(planId, filePath, 'failed', `Inference timed out after ${Math.round(timeoutMs / 1000)}s`);
        sendEvent({
          type: SemanticEventName.FILE_FAILED,
          producerId: tempAgent.getId(),
          occurredAt: new Date(),
          payload: { planId, filePath, reason: `Inference timed out after ${Math.round(timeoutMs / 1000)}s` },
        }, tempAgent.getId());
        leave(tempAgent);
        resolve();
      }
    }, timeoutMs);

    try {
      console.log(`[WorkerAgent:${tempAgent.getId()}] Starting inference loop for ${filePath}...`);
      const loopResult = runLoop(tempAgent.getId(), prompt, {
        model: modelToUse,
        context: tempAgent.getMemory().getContext(),
        tools: tempAgent.getTools(),
      }) as unknown as Promise<void> | undefined;

      if (loopResult && typeof loopResult.catch === 'function') {
        loopResult.catch(async (error: unknown) => {
          clearTimeout(timer);
          console.error(`[WorkerAgent:${tempAgent.getId()}] Async inference error:`, error);
          if (!isDone) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await repository.updateTaskStatus(planId, filePath, 'failed', errorMessage || 'Inference network error');
            sendEvent({
              type: SemanticEventName.FILE_FAILED,
              producerId: tempAgent.getId(),
              occurredAt: new Date(),
              payload: { planId, filePath, reason: errorMessage || 'Inference network error' },
            }, tempAgent.getId());
            leave(tempAgent);
            resolve();
          }
        });
      }
    } catch (error: unknown) {
      clearTimeout(timer);
      console.error(`[WorkerAgent:${tempAgent.getId()}] Sync error:`, error);
      if (!isDone) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await repository.updateTaskStatus(planId, filePath, 'failed', errorMessage || 'Sync error');
        sendEvent({
          type: SemanticEventName.FILE_FAILED,
          producerId: tempAgent.getId(),
          occurredAt: new Date(),
          payload: { planId, filePath, reason: errorMessage || 'Sync error' },
        }, tempAgent.getId());
        leave(tempAgent);
        resolve();
      }
    }
  });
}
