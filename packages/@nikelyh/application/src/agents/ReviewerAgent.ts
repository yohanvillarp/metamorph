import {
  createAgent,
  SituationSpecification,
  SituationContext,
  SituationHandler,
  Agent,
  Tool,
} from '@mozaik-ai/core';
import { runLoop, join, leave } from '../runtime';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';

class WhenFileMigrated extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_MIGRATED;
  }
}

class WhenReviewCompleted extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === 'model.answer' && event.producerId === participant.getId();
  }
}

const reviewFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileMigrated;
    console.log(`[ReviewerAgent] Reviewing migrated file: ${payload.filePath}`);
    
    const { createAgent: createMozaikAgent } = await import('@mozaik-ai/core');
    const { sendEvent } = await import('../runtime');
    
    const reviewerId = `Reviewer-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    
    const approveTool: Tool = {
      type: 'function',
      name: 'approve_migration',
      description: 'Call this tool when the migration is perfectly correct and meets all requirements.',
      parameters: { type: 'object', properties: {} },
      strict: true,
      invoke: async () => {
        console.log(`[ReviewerAgent:${reviewerId}] File ${payload.filePath} approved!`);
        sendEvent({
          type: SemanticEventName.FILE_REVIEWED,
          producerId: reviewerId,
          occurredAt: new Date(),
          payload: { planId: payload.planId, filePath: payload.filePath },
        }, reviewerId);
        return "Migration approved.";
      }
    };

    const rejectTool: Tool = {
      type: 'function',
      name: 'reject_migration',
      description: 'Call this tool when the migration has syntax errors, uses wrong libraries, or violates requirements.',
      parameters: {
        type: 'object',
        properties: {
          errors: { type: 'array', items: { type: 'string' }, description: 'List of specific errors found' }
        },
        required: ['errors']
      },
      strict: true,
      invoke: async ({ errors }: { errors: string[] }) => {
        console.log(`[ReviewerAgent:${reviewerId}] File ${payload.filePath} REJECTED. Errors:`, errors);
        sendEvent({
          type: SemanticEventName.FILE_REJECTED,
          producerId: reviewerId,
          occurredAt: new Date(),
          payload: { planId: payload.planId, filePath: payload.filePath, errors },
        }, reviewerId);
        return "Migration rejected.";
      }
    };

    const tempAgent = createMozaikAgent({
      name: reviewerId,
      capabilities: ['code_review', 'inference'],
      instruction: 'You are the Quality Assurance Reviewer. You must review the migrated code. You must CALL either approve_migration or reject_migration based on your evaluation. Be strict! Check for proper syntax, imports, and correct framework usage.',
      tools: [approveTool, rejectTool],
      handlers: [
        {
          specification: new WhenReviewCompleted(),
          processor: {
            async apply({ participant }) {
              // Just clean up, the events were emitted by the tools
              leave(participant);
            }
          }
        }
      ],
    });
    
    join(tempAgent);

    let prompt = `Review the following file migration: ${payload.filePath}\nDiff or new content:\n${payload.diff}\nDoes it meet the criteria? You MUST use a tool to approve or reject.`;

    // Fire and forget
    runLoop(tempAgent.getId(), prompt, {
      model: process.env.METAMORPH_REVIEWER_MODEL || 'gemini-3.5-flash', 
      context: tempAgent.getMemory().getContext(),
      tools: tempAgent.getTools(), 
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
    tools: tools,
    handlers: [reviewFileHandler],
  });
}
