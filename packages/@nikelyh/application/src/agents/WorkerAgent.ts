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

class WhenFileRejected extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_REJECTED;
  }
}

class WhenInferenceCompleted extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === 'model.answer' && event.producerId === participant.getId();
  }
}

async function startWorkerLoop(planId: string, filePath: string, prompt: string, participant: Agent) {
  const runtime = resolveRuntime();
  const repository = runtime.state.repository;

  console.log(`[WorkerAgent] Marking file as 'in_progress' in database...`);
  await repository.updateTaskStatus(planId, filePath, 'in_progress');

  const { createAgent: createMozaikAgent } = await import('@mozaik-ai/core');
  
  const tempAgent = createMozaikAgent({
    name: `Worker-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    capabilities: ['code_refactoring', 'inference'],
    instruction: 'You are the Programmer Worker. Your job is to refactor specific files based on the migration profile using your file reading and writing tools. When you are done modifying the file, simply finish your response.',
    tools: participant.getTools(),
    handlers: [
      {
        specification: new WhenInferenceCompleted(),
        processor: {
          async apply({ participant: tempParticipant }) {
            console.log(`[WorkerAgent:${tempParticipant.getId()}] Inference completed. Emitting FILE_MIGRATED.`);
            
            await repository.updateTaskStatus(planId, filePath, 'completed' as any);
            
            sendEvent(
              {
                type: SemanticEventName.FILE_MIGRATED,
                producerId: tempParticipant.getId(),
                occurredAt: new Date(),
                payload: {
                  planId: planId,
                  filePath: filePath,
                  diff: 'Diff simulation: migrated correctly', 
                } as SemanticEventPayloads.FileMigrated,
              },
              tempParticipant.getId()
            );

            leave(tempParticipant);
          }
        }
      }
    ],
  });
  
  join(tempAgent);

  const modelToUse = process.env.METAMORPH_MODEL || 'deepseek-v4-flash';
  
  console.log(`[WorkerAgent:${tempAgent.getId()}] Starting inference loop for ${filePath}...`);
  runLoop(tempAgent.getId(), prompt, {
    model: modelToUse, 
    context: tempAgent.getMemory().getContext(),
    tools: tempAgent.getTools(),
  });
}

const workOnFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileDiscovered;
    console.log(`[WorkerAgent] Received file to migrate: ${payload.filePath}`);
    
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(payload.planId);
    let prompt = `You need to migrate the file at path: ${payload.filePath}\n`;
    if (plan) {
      prompt += `Migration Rules: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
      if (plan.profile.rules) {
        prompt += `Specific Rules: ${plan.profile.rules.join(', ')}\n`;
      }
    }
    prompt += `Please read the file using your tools, rewrite it according to the rules, and write it back.`;

    await startWorkerLoop(payload.planId, payload.filePath, prompt, participant as Agent);
  },
};

const fixRejectedFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileRejected;
    console.log(`[WorkerAgent] File REJECTED, initiating repair loop: ${payload.filePath}`);
    
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(payload.planId);
    let prompt = `You need to FIX the file at path: ${payload.filePath}\n`;
    prompt += `Your previous migration was REJECTED by the Quality Assurance Reviewer.\n`;
    prompt += `Feedback/Errors:\n${payload.errors.join('\n')}\n\n`;
    if (plan) {
      prompt += `Migration Rules: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
    }
    prompt += `Please read the file, fix the issues mentioned, and write it back.`;

    await startWorkerLoop(payload.planId, payload.filePath, prompt, participant as Agent);
  },
};

export function createWorkerAgent(tools: Tool[]): Agent {
  return createAgent({
    name: 'Worker',
    capabilities: ['code_refactoring', 'inference'],
    instruction: 'You are the Programmer Worker.',
    tools: tools,
    handlers: [
      { specification: new WhenFileDiscovered(), processor: workOnFileProcessor },
      { specification: new WhenFileRejected(), processor: fixRejectedFileProcessor }
    ],
  });
}
