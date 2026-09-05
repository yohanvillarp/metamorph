import {
  createAgent,
  SituationSpecification,
  SituationContext,
  SituationHandler,
  Agent,
} from '@mozaik-ai/core';
import { resolveRuntime, sendEvent } from '../runtime';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';

/**
 * Specification to match the MIGRATION_STARTED event on the bus.
 */
class WhenMigrationStarts extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.MIGRATION_STARTED;
  }
}

/**
 * Processor for the MapperAgent when a migration starts.
 */
const mapFilesProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.MigrationStarted;
    console.log(`[MapperAgent] Migration started for Plan: ${payload.planId}`);
    
    // In a real scenario, this agent would scan the folder tree and AST.
    // For now, we simulate discovering one file and publishing the event.
    const discoveredFile = 'src/index.ts';
    console.log(`[MapperAgent] Discovered file: ${discoveredFile}`);

    // Fire the event to the Mozaik bus so the WorkerAgent wakes up
    sendEvent(
      {
        type: SemanticEventName.FILE_DISCOVERED,
        producerId: participant.getId(),
        occurredAt: new Date(),
        payload: {
          planId: payload.planId,
          filePath: discoveredFile,
        } as SemanticEventPayloads.FileDiscovered,
      },
      participant.getId()
    );
  },
};

const mapFilesHandler: SituationHandler = {
  specification: new WhenMigrationStarts(),
  processor: mapFilesProcessor,
};

/**
 * Creates the MapperAgent instance.
 */
export function createMapperAgent(): Agent {
  return createAgent({
    name: 'Mapper',
    capabilities: ['code_analysis'],
    instruction: 'You are the Architect Mapper. Your job is to analyze the source code and discover files that need migration.',
    tools: [], // AST scanning tools will go here later
    handlers: [mapFilesHandler],
  });
}
