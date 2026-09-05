import {
  createAgent,
  SituationSpecification,
  SituationContext,
  SituationHandler,
  Agent,
  Tool,
} from '@mozaik-ai/core';
import { resolveRuntime, runLoop, join, leave, sendEvent } from '../runtime';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';

class WhenFileDiscovered extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_DISCOVERED;
  }
}

class WhenInferenceCompleted extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    // Only react to our own final answer
    return event.type === 'model.answer' && event.producerId === participant.getId();
  }
}

const workOnFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileDiscovered;
    console.log(`[WorkerAgent] Received file to migrate: ${payload.filePath}`);
    
    const runtime = resolveRuntime();
    const repository = runtime.state.repository;

    console.log(`[WorkerAgent] Marking file as 'in_progress' in database...`);
    await repository.updateTaskStatus(payload.planId, payload.filePath, 'in_progress');

    // We get the migration plan context to inform the LLM
    const plan = await repository.getPlan(payload.planId);
    let prompt = `You need to migrate the file at path: ${payload.filePath}\n`;
    if (plan) {
      prompt += `Migration Rules: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
      if (plan.profile.rules) {
        prompt += `Specific Rules: ${plan.profile.rules.join(', ')}\n`;
      }
    }
    prompt += `Please read the file using your tools, rewrite it according to the rules, and write it back.`;

    const { createAgent: createMozaikAgent } = await import('@mozaik-ai/core');
    
    // Create a fresh agent for this specific file to avoid DeepSeek API history errors
    const tempAgent = createMozaikAgent({
      name: `Worker-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      capabilities: ['code_refactoring', 'inference'],
      instruction: 'You are the Programmer Worker. Your job is to refactor specific files based on the migration profile using your file reading and writing tools. When you are done modifying the file, simply finish your response.',
      tools: (participant as Agent).getTools(),
      handlers: [
        {
          specification: new WhenInferenceCompleted(),
          processor: {
            async apply({ participant }) {
              console.log(`[WorkerAgent:${participant.getId()}] Inference completed. Emitting FILE_MIGRATED.`);
              
              await repository.updateTaskStatus(payload.planId, payload.filePath, 'completed' as any);
              
              sendEvent(
                {
                  type: SemanticEventName.FILE_MIGRATED,
                  producerId: participant.getId(),
                  occurredAt: new Date(),
                  payload: {
                    planId: payload.planId,
                    filePath: payload.filePath,
                    diff: 'Diff simulation: migrated correctly', 
                  } as SemanticEventPayloads.FileMigrated,
                },
                participant.getId()
              );

              // Cleanup
              leave(participant);
            }
          }
        }
      ],
    });
    
    join(tempAgent);

    const modelToUse = process.env.METAMORPH_MODEL || 'deepseek-v4-flash';
    
    console.log(`[WorkerAgent:${tempAgent.getId()}] Starting inference loop for ${payload.filePath}...`);
    // Fire and forget
    runLoop(tempAgent.getId(), prompt, {
      model: modelToUse, 
      context: tempAgent.getMemory().getContext(),
      tools: tempAgent.getTools(),
    });
  },
};

const workOnFileHandler: SituationHandler = {
  specification: new WhenFileDiscovered(),
  processor: workOnFileProcessor,
};

/**
 * Creates the WorkerAgent instance.
 */
export function createWorkerAgent(tools: Tool[]): Agent {
  return createAgent({
    name: 'Worker',
    capabilities: ['code_refactoring', 'inference'],
    instruction: 'You are the Programmer Worker.',
    tools: tools,
    handlers: [workOnFileHandler],
  });
}
