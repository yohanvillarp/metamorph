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
    
    const tempAgent = createMozaikAgent({
      name: `Reviewer-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      capabilities: ['code_review', 'inference'],
      instruction: 'You are the Quality Assurance Reviewer. You must review the migrated code. Look at the diff and the file content, and if everything looks correct, just say "Looks good". If there are issues, point them out.',
      tools: [], // Hardcoded to empty to avoid Gemini API thought_signature bug
      handlers: [
        {
          specification: new WhenReviewCompleted(),
          processor: {
            async apply({ participant }) {
              console.log(`[ReviewerAgent:${participant.getId()}] File ${payload.filePath} approved by Gemini!`);
              // Emit event to update telemetry
              const { sendEvent } = await import('../runtime');
              sendEvent(
                {
                  type: SemanticEventName.FILE_REVIEWED,
                  producerId: participant.getId(),
                  occurredAt: new Date(),
                  payload: {
                    planId: payload.planId,
                    filePath: payload.filePath,
                  },
                },
                participant.getId()
              );
              leave(participant);
            }
          }
        }
      ],
    });
    
    join(tempAgent);

    let prompt = `Review the following file migration: ${payload.filePath}\nDiff:\n${payload.diff}\nDoes it meet the criteria?`;

    // Fire and forget
    runLoop(tempAgent.getId(), prompt, {
      model: process.env.METAMORPH_REVIEWER_MODEL || 'gemini-3.5-flash', 
      context: tempAgent.getMemory().getContext(),
      tools: [], 
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
