import {
  createAgent,
  SituationSpecification,
  SituationContext,
  SituationHandler,
  Agent,
  Tool,
} from '@mozaik-ai/core';
import { resolveRuntime, runLoop } from '../runtime';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';

class WhenFileDiscovered extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_DISCOVERED;
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

    // Start thinking via Inference Loop
    console.log(`[WorkerAgent] Starting inference loop for ${payload.filePath}...`);
    
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

    const agent = participant as Agent;
    
    // Trigger Mozaik's internal runLoop which talks to the LLM
    runLoop(agent.getId(), prompt, {
      model: 'deepseek-v4-pro', // Using DeepSeek as default
      context: agent.getMemory().getContext(),
      tools: agent.getTools(),
    });
  },
};

const workOnFileHandler: SituationHandler = {
  specification: new WhenFileDiscovered(),
  processor: workOnFileProcessor,
};

/**
 * Creates the WorkerAgent instance.
 * @param tools The AST tools provided by infrastructure
 */
export function createWorkerAgent(tools: Tool[]): Agent {
  return createAgent({
    name: 'Worker',
    capabilities: ['code_refactoring', 'inference'],
    instruction: 'You are the Programmer Worker. Your job is to refactor specific files based on the migration profile using your file reading and writing tools. When you are done modifying the file, simply finish your response.',
    tools: tools,
    handlers: [workOnFileHandler],
  });
}
