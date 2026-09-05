import {
  createAgent,
  SituationSpecification,
  SituationContext,
  SituationHandler,
  Agent,
} from '@mozaik-ai/core';
import { resolveRuntime } from '../runtime';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';

/**
 * Specification to match the FILE_DISCOVERED event on the bus.
 */
class WhenFileDiscovered extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_DISCOVERED;
  }
}

/**
 * Processor for the WorkerAgent when a file is discovered.
 */
const workOnFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileDiscovered;
    console.log(`[WorkerAgent] Received file to migrate: ${payload.filePath}`);
    
    // Access the injected SQLite repository from the shared RuntimeState
    const runtime = resolveRuntime();
    const repository = runtime.state.repository;

    console.log(`[WorkerAgent] Marking file as 'in_progress' in database...`);
    await repository.updateTaskStatus(payload.planId, payload.filePath, 'in_progress');

    // In a real scenario, this is where we would call runLoop() to trigger
    // the LLM inference loop and perform the actual AST refactoring.
    console.log(`[WorkerAgent] Refactoring logic simulated. Done.`);
  },
};

const workOnFileHandler: SituationHandler = {
  specification: new WhenFileDiscovered(),
  processor: workOnFileProcessor,
};

/**
 * Creates the WorkerAgent instance.
 */
export function createWorkerAgent(): Agent {
  return createAgent({
    name: 'Worker',
    capabilities: ['code_refactoring', 'inference'],
    instruction: 'You are the Programmer Worker. Your job is to refactor specific files based on the migration profile.',
    tools: [], // File writing tools will go here later
    handlers: [workOnFileHandler],
  });
}
