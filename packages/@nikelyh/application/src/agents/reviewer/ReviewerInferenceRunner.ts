import {
  Agent,
  createAgent as createMozaikAgent,
  SituationContext,
  SituationSpecification,
} from '@mozaik-ai/core';
import {
  formatCatalogRules,
  MigrationPlan,
  resolveMigrationCatalog,
  SemanticEventName,
  SemanticEventPayloads,
  TokenUsage,
} from '@nikelyh/domain';
import { collectFileHints } from '../../migration/registry';
import { join, leave, resolveRuntime, runLoop, sendEvent } from '../../runtime';
import { buildNeighborContext } from '../../context/NeighborContext';

export interface ReviewParsedResult {
  status: 'APPROVED' | 'REJECTED' | 'FATAL_MISMATCH';
  errors: string[];
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

export function buildReviewPrompt(filePath: string, diff: string, plan?: MigrationPlan | null): string {
  let prompt = `Review the following file migration: ${filePath}\n`;

  if (plan) {
    prompt += `Migration Profile: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
    const catalogEntry = resolveMigrationCatalog(plan.profile.source, plan.profile.target);
    if (catalogEntry) {
      prompt += `\nArchitectural rules (all → ${catalogEntry.layer} → frameworks → this pair; apply only if relevant to this file):\n`;
      prompt += `${formatCatalogRules(catalogEntry.ruleSections)}\n`;
    }
    prompt += collectFileHints(
      filePath,
      { source: plan.profile.source, target: plan.profile.target },
      catalogEntry?.layer
    );
  }

  prompt += `\n${buildNeighborContext(filePath)}\nDiff or new content of the file under review:\n${diff}\nCompare the diff to imported modules in the evidence. If props/exports do not match, REJECT with a specific error. You MUST respond in JSON.`;
  return prompt;
}

function parseReviewResult(answerText: string | null): ReviewParsedResult | null {
  if (!answerText) return null;
  try {
    return JSON.parse(answerText) as ReviewParsedResult;
  } catch (e) {
    console.error(`[Reviewer] Failed to parse JSON:`, e);
    return null;
  }
}

async function dispatchReviewResult(
  result: ReviewParsedResult,
  payload: SemanticEventPayloads.FileMigrated,
  participantId: string
): Promise<void> {
  const runtime = resolveRuntime();

  if (result.status === 'APPROVED') {
    console.log(`[Reviewer] File ${payload.filePath} APPROVED!`);
    await runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'completed');
    sendEvent({
      type: SemanticEventName.FILE_REVIEWED,
      producerId: participantId,
      occurredAt: new Date(),
      payload: { planId: payload.planId, filePath: payload.filePath },
    }, participantId);
  } else if (result.status === 'FATAL_MISMATCH') {
    console.error(`[Reviewer] File ${payload.filePath} FATAL_MISMATCH!`, result.errors);
    sendEvent({
      type: SemanticEventName.FILE_FATAL_MISMATCH,
      producerId: participantId,
      occurredAt: new Date(),
      payload: {
        planId: payload.planId,
        filePath: payload.filePath,
        reason: result.errors?.join(' | ') || 'Fundamental architectural mismatch',
      },
    }, participantId);
  } else {
    console.log(`[Reviewer] File ${payload.filePath} REJECTED. Errors:`, result.errors);
    sendEvent({
      type: SemanticEventName.FILE_REJECTED,
      producerId: participantId,
      occurredAt: new Date(),
      payload: {
        planId: payload.planId,
        filePath: payload.filePath,
        errors: result.errors || ['Migration rejected by reviewer'],
      },
    }, participantId);
  }
}

export async function runReviewInference(
  payload: SemanticEventPayloads.FileMigrated,
  prompt: string
): Promise<void> {
  return new Promise((originalResolve) => {
    let isDone = false;
    const resolve = () => {
      if (!isDone) {
        isDone = true;
        originalResolve();
      }
    };

    const runtime = resolveRuntime();
    const config = runtime.state.config;
    const modelToUse =
      config?.reviewerModel ||
      config?.model ||
      process.env.METAMORPH_REVIEWER_MODEL ||
      process.env.METAMORPH_MODEL ||
      'gpt-5.4';
    const timeoutMs = config?.inferenceTimeoutMs || 120000;

    let capturedUsage: TokenUsage | null = null;
    const reviewerId = `Reviewer-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const tempAgent = createMozaikAgent({
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
              try {
                const answerItem = (event.payload as Record<string, any>).answer;
                const answerText = answerItem?.content?.text || answerItem?.text || null;
                const result = parseReviewResult(answerText);
                if (result) {
                  await dispatchReviewResult(result, payload, tempParticipant.getId());
                }
                sendEvent({
                  type: SemanticEventName.TOKENS_REPORTED,
                  producerId: tempParticipant.getId(),
                  occurredAt: new Date(),
                  payload: {
                    planId: payload.planId,
                    agentRole: 'reviewer',
                    modelId: modelToUse,
                    tokenUsage: capturedUsage,
                    promptText: prompt,
                    completionText: answerText || '',
                  } as SemanticEventPayloads.TokensReported,
                }, tempParticipant.getId());
              } catch (e) {
                console.error(`[ReviewerAgent:${tempParticipant.getId()}] Error completing review:`, e);
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
        console.error(`[ReviewerAgent:${reviewerId}] ⏰ TIMEOUT after ${Math.round(timeoutMs / 1000)}s.`);
        await runtime.state.repository.updateTaskStatus(
          payload.planId,
          payload.filePath,
          'failed',
          `Inference timed out after ${Math.round(timeoutMs / 1000)}s`
        );
        sendEvent({
          type: SemanticEventName.FILE_FAILED,
          producerId: tempAgent.getId(),
          occurredAt: new Date(),
          payload: {
            planId: payload.planId,
            filePath: payload.filePath,
            reason: `Inference timed out after ${Math.round(timeoutMs / 1000)}s`,
          },
        }, tempAgent.getId());
        leave(tempAgent);
        resolve();
      }
    }, timeoutMs);

    try {
      console.log(`[ReviewerAgent:${reviewerId}] Starting inference for ${payload.filePath} with model ${modelToUse}...`);
      const loopResult = runLoop(tempAgent.getId(), prompt, {
        model: modelToUse,
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
        loopResult.catch(async (error: unknown) => {
          clearTimeout(timer);
          console.error(`[ReviewerAgent:${reviewerId}] Async review error:`, error);
          if (!isDone) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'failed', errorMessage || 'Review inference network error');
            sendEvent({
              type: SemanticEventName.FILE_FAILED,
              producerId: tempAgent.getId(),
              occurredAt: new Date(),
              payload: { planId: payload.planId, filePath: payload.filePath, reason: errorMessage || 'Review inference network error' },
            }, tempAgent.getId());
            leave(tempAgent);
            resolve();
          }
        });
      }
    } catch (error: unknown) {
      clearTimeout(timer);
      console.error(`[ReviewerAgent:${reviewerId}] Sync error:`, error);
      if (!isDone) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'failed', errorMessage || 'Sync error');
        sendEvent({
          type: SemanticEventName.FILE_FAILED,
          producerId: tempAgent.getId(),
          occurredAt: new Date(),
          payload: { planId: payload.planId, filePath: payload.filePath, reason: errorMessage || 'Sync error' },
        }, tempAgent.getId());
        leave(tempAgent);
        resolve();
      }
    }
  });
}
