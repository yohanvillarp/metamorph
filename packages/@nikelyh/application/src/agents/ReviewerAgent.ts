import {
  Agent,
  createAgent,
  SituationContext,
  SituationHandler,
  SituationSpecification,
  Tool,
} from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads, findMigrationCatalogEntry } from '@nikelyh/domain';
import { join, leave, runLoop, resolveRuntime } from '../runtime';

class ConcurrencyQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  
  constructor(private concurrencyLimit: number) {}

  async enqueue(task: () => Promise<void>) {
    this.queue.push(task);
    this.pump();
  }

  private async pump() {
    if (this.activeCount >= this.concurrencyLimit || this.queue.length === 0) {
      return;
    }
    const task = this.queue.shift();
    if (task) {
      this.activeCount++;
      try {
        await task();
      } catch (error) {
        console.error('Task error:', error);
      } finally {
        this.activeCount--;
        this.pump();
      }
    }
  }
}

const reviewerQueue = new ConcurrencyQueue(2); // Maximum 2 concurrent reviewers

class WhenFileMigrated extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_MIGRATED;
  }
}

class WhenReviewCompleted extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    // DEBUG: Log EVERY event that hits this specification
    console.log(`[DEBUG:WhenReviewCompleted] Event received -> type: "${event.type}", producerId: "${event.producerId}", participantId: "${participant.getId()}", match: ${event.type === 'model.answer' && event.producerId === participant.getId()}`);
    return event.type === 'model.answer' && event.producerId === participant.getId();
  }
}

// DEBUG: Catch-all specification to see ALL events hitting the temp agent
class WhenAnythingHappens extends SituationSpecification {
  isSatisfiedBy(): boolean {
    return true; // matches everything
  }
}

const reviewFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileMigrated;
    console.log(`[ReviewerAgent] Reviewing migrated file: ${payload.filePath}`);
    
    reviewerQueue.enqueue(async () => {
      return new Promise(async (originalResolve) => {
        let isDone = false;
        const resolve = () => {
          if (!isDone) {
            isDone = true;
            console.log(`[DEBUG:ReviewerAgent] Promise resolved for ${payload.filePath}`);
            originalResolve();
          }
        };
        const { createAgent: createMozaikAgent } = await import('@mozaik-ai/core');
        const { sendEvent } = await import('../runtime');
        
        const reviewerId = `Reviewer-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    const tempAgent = createMozaikAgent({
      name: reviewerId,
      capabilities: ['code_review', 'inference'],
      instruction: 'You are the Quality Assurance Reviewer. You must review the migrated code. Note that you are reviewing a SINGLE FILE within a larger migration. Evaluate if the file violates architectural rules, but DO NOT reject it simply because it does not demonstrate all architectural features (e.g. do not reject a test file or a bootstrap file just because it lacks a Controller). If the worker completely violated the architectural paradigm in a way that cannot be fixed by a simple code edit, use status FATAL_MISMATCH to abort.',
      tools: [], // No tools to avoid Gemini thought_signature crash
      handlers: [
        // DEBUG: Catch-all handler to log every event this agent receives
        {
          specification: new WhenAnythingHappens(),
          processor: {
            async apply({ event: anyEvent, participant: anyParticipant }) {
              console.log(`[DEBUG:ReviewerAgent:${reviewerId}:CATCH_ALL] Event -> type: "${anyEvent.type}", producerId: "${anyEvent.producerId}", myId: "${anyParticipant.getId()}", payload keys: ${Object.keys((anyEvent.payload as Record<string, unknown>) || {}).join(',')}`);
            }
          }
        },
        {
          specification: new WhenReviewCompleted(),
          processor: {
            async apply({ event, participant: tempParticipant }) {
              console.log(`[DEBUG:ReviewerAgent:${reviewerId}] model.answer RECEIVED!`);
              const answerItem = (event.payload as Record<string, any>).answer;
              // Extract text: Mozaik puts it in answerItem.content.text, not answerItem.text
              const answerText = answerItem?.content?.text || answerItem?.text || null;
              console.log(`[DEBUG:ReviewerAgent:${reviewerId}] answerText:`, answerText);
              
              let reviewResult: { status: string; errors: string[] } | null = null;
              if (answerText) {
                try {
                  reviewResult = JSON.parse(answerText);
                  console.log(`[DEBUG:ReviewerAgent:${reviewerId}] Parsed result:`, JSON.stringify(reviewResult));
                } catch (e) {
                  console.error(`[ReviewerAgent:${reviewerId}] Failed to parse JSON:`, e);
                }
              } else {
                console.warn(`[DEBUG:ReviewerAgent:${reviewerId}] answerItem has no extractable text.`);
              }

              // Emit review result event BEFORE leaving (sendEvent needs an active participant)
              if (reviewResult) {
                const participantId = tempParticipant.getId();
                try {
                  if (reviewResult.status === 'APPROVED') {
                    console.log(`[ReviewerAgent:${reviewerId}] File ${payload.filePath} APPROVED!`);
                    sendEvent({
                      type: SemanticEventName.FILE_REVIEWED,
                      producerId: participantId,
                      occurredAt: new Date(),
                      payload: { planId: payload.planId, filePath: payload.filePath },
                    }, participantId);
                  } else if (reviewResult.status === 'FATAL_MISMATCH') {
                    console.error(`[ReviewerAgent:${reviewerId}] File ${payload.filePath} FATAL_MISMATCH! Aborting repair. Errors:`, reviewResult.errors);
                    sendEvent({
                      type: SemanticEventName.FILE_FATAL_MISMATCH,
                      producerId: participantId,
                      occurredAt: new Date(),
                      payload: { planId: payload.planId, filePath: payload.filePath, reason: reviewResult.errors?.join(' | ') || 'Fundamental architectural mismatch' },
                    }, participantId);
                  } else {
                    console.log(`[ReviewerAgent:${reviewerId}] File ${payload.filePath} REJECTED. Errors:`, reviewResult.errors);
                    sendEvent({
                      type: SemanticEventName.FILE_REJECTED,
                      producerId: participantId,
                      occurredAt: new Date(),
                      payload: { planId: payload.planId, filePath: payload.filePath, errors: reviewResult.errors || ['Migration rejected by reviewer'] },
                    }, participantId);
                  }
                } catch (e) {
                  console.error(`[ReviewerAgent:${reviewerId}] Failed to send review event:`, e);
                }

                // Check if all tasks are complete
                try {
                  const runtime = await resolveRuntime();
                  const plan = await runtime.state.repository.getPlan(payload.planId);
                  if (plan) {
                    const allTerminal = plan.tasks.every(t => t.status === 'completed' || t.status === 'failed');
                    if (allTerminal) {
                      console.log(`[App] All tasks reached terminal state. Emitting MIGRATION_COMPLETED.`);
                      sendEvent({
                        type: SemanticEventName.MIGRATION_COMPLETED,
                        producerId: participantId,
                        occurredAt: new Date(),
                        payload: { planId: payload.planId },
                      }, participantId);
                    }
                  }
                } catch (e) {
                  console.error(`[ReviewerAgent:${reviewerId}] Failed to check migration completion:`, e);
                }
              }

              leave(tempParticipant);
              resolve();
            }
          }
        }
      ],
    });
    
    console.log(`[DEBUG:ReviewerAgent:${reviewerId}] tempAgent created with id: ${tempAgent.getId()}`);
    join(tempAgent);
    console.log(`[DEBUG:ReviewerAgent:${reviewerId}] tempAgent joined the runtime`);

    const runtime = resolveRuntime();
    
    // --- Pre-LLM Static Syntax Check ---
    if (payload.filePath.endsWith('.ts') || payload.filePath.endsWith('.tsx')) {
      try {
        const { Project } = await import('ts-morph');
        const tsProject = new Project();
        const sf = tsProject.addSourceFileAtPath(payload.filePath);
        const diagnostics = sf.getPreEmitDiagnostics();
        const syntaxErrors = diagnostics.filter(d => d.getCode() >= 1000 && d.getCode() < 2000);
        
        if (syntaxErrors.length > 0) {
          console.error(`[ReviewerAgent:${reviewerId}] Syntax Error in ${payload.filePath}. Rejecting immediately.`);
          const { sendEvent } = await import('../runtime');
          sendEvent({
            type: SemanticEventName.FILE_REJECTED,
            producerId: tempAgent.getId(),
            occurredAt: new Date(),
            payload: { 
              planId: payload.planId, 
              filePath: payload.filePath, 
              errors: syntaxErrors.map(d => `TS${d.getCode()}: ${d.getMessageText()}`) 
            },
          }, tempAgent.getId());
          
          leave(tempAgent);
          resolve();
          return;
        }
      } catch (e) {
        console.warn(`[ReviewerAgent:${reviewerId}] Failed to run syntax check:`, e);
      }
    }
    // -----------------------------------

    const plan = await runtime.state.repository.getPlan(payload.planId);
    let prompt = `Review the following file migration: ${payload.filePath}\n`;
    
    if (plan) {
      prompt += `Migration Profile: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
      const catalogEntry = findMigrationCatalogEntry(plan.profile.source, plan.profile.target);
      if (catalogEntry) {
        prompt += `\nStrict Architectural Rules for this Migration (apply only if relevant to this file's purpose):\n`;
        catalogEntry.architecturalRules.forEach(rule => prompt += `- ${rule}\n`);
      }
    }
    
    prompt += `\nDiff or new content:\n${payload.diff}\nDoes it meet the criteria? You MUST respond in JSON.`;

    const modelToUse = process.env.METAMORPH_REVIEWER_MODEL || process.env.METAMORPH_MODEL || 'gpt-5.4-mini';
    console.log(`[ReviewerAgent:${reviewerId}] Starting inference loop for ${payload.filePath} with model ${modelToUse}...`);

    try {
      console.log(`[DEBUG:ReviewerAgent:${reviewerId}] Calling runLoop with agentId: ${tempAgent.getId()}`);
      runLoop(tempAgent.getId(), prompt, {
        model: modelToUse, 
        context: tempAgent.getMemory().getContext(),
        structuredOutput: {
          name: 'review_result',
          schema: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['APPROVED', 'REJECTED', 'FATAL_MISMATCH'] },
              errors: { type: 'array', items: { type: 'string' } }
            },
            required: ['status', 'errors'],
            additionalProperties: false
          },
          strict: true
        }
      });
      console.log(`[DEBUG:ReviewerAgent:${reviewerId}] runLoop called successfully (fire-and-forget)`);

      setTimeout(async () => {
        if (!isDone) {
          console.error(`[ReviewerAgent:${reviewerId}] ⏰ TIMEOUT after 45s for ${payload.filePath}. Model never responded.`);
          const { resolveRuntime } = await import('../runtime');
          const runtime = resolveRuntime();
          await runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'failed', 'Inference timed out after 45s');
          leave(tempAgent);
          resolve();
        }
      }, 45000);
    } catch (error: unknown) {
      console.error(`[ReviewerAgent:${reviewerId}] Sync error:`, error);
      if (!isDone) {
        const { resolveRuntime } = await import('../runtime');
        const runtime = resolveRuntime();
        const errorMessage = error instanceof Error ? error.message : String(error);
        await runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'failed', errorMessage || 'Sync error');
        leave(tempAgent);
        resolve();
      }
    }
      });
    });
  },
};

const reviewFileHandler: SituationHandler = {
  specification: new WhenFileMigrated(),
  processor: reviewFileProcessor,
};

/**
 * Creates the ReviewerAgent instance.
 */
export function createReviewerAgent(tools: Tool[]): Agent {
  return createAgent({
    name: 'Reviewer',
    capabilities: ['code_review', 'inference'],
    instruction: 'You are the Reviewer Worker.',
    tools: [], // No tools
    handlers: [reviewFileHandler],
  });
}
