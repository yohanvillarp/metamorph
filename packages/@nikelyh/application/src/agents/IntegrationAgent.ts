import {
  Agent,
  createAgent,
  SituationContext,
  SituationHandler,
  SituationSpecification,
  Tool,
} from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads, findMigrationCatalogEntry } from '@nikelyh/domain';
import { join, leave, runLoop, sendEvent, resolveRuntime } from '../runtime';

class WhenIntegrationStarts extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.PHASE_INTEGRATION_STARTED;
  }
}

const integrationProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as { planId: string };
    console.log(`[IntegrationAgent] Started integration phase for plan ${payload.planId}`);
    
    const agent = participant as unknown as Agent;
    const tools = agent.getTools();
    
    const prompt = `The migration phase is complete, and we are now in the Integration Phase.
Your task is to verify that all cross-file dependencies (imports and exports) are correct.

Step 1: Use the check_project_diagnostics tool to find any broken local imports/exports.
Step 2: If there are errors (e.g. TS2305 Module has no exported member), use the read_file tool to inspect the broken files and the files they are trying to import.
Step 3: Use the write_file or replace_file_content tools (or similar AST tools provided) to fix the imports/exports so the project integrates cleanly.
Step 4: Run check_project_diagnostics again to verify your fixes.
Step 5: When check_project_diagnostics reports no local errors, respond with a final message indicating success and STOP. If you cannot fix an error after a few tries, explain why and stop.
`;

    // To prevent blocking the main loop, we run this asynchronously and manage the leave/sendEvent
    let isDone = false;
    try {
      sendEvent({
        type: SemanticEventName.SYSTEM_LOG as any,
        producerId: participant.getId(),
        occurredAt: new Date(),
        payload: { planId: payload.planId, message: 'IntegrationAgent is checking cross-file dependencies...', level: 'info' }
      }, participant.getId());

      await runLoop(participant.getId(), prompt, {
        model: 'gemini-2.5-pro', // or use the default provided by runtime
        context: agent.getMemory().getContext(),
        tools: tools,
      });

      sendEvent({
        type: SemanticEventName.SYSTEM_LOG as any,
        producerId: participant.getId(),
        occurredAt: new Date(),
        payload: { planId: payload.planId, message: 'Integration Phase complete. Migration is ready for review.', level: 'info' }
      }, participant.getId());

      // Once done, emit MIGRATION_COMPLETED
      sendEvent({
        type: SemanticEventName.MIGRATION_COMPLETED,
        producerId: participant.getId(),
        occurredAt: new Date(),
        payload: { planId: payload.planId },
      }, participant.getId());

    } catch (error: unknown) {
      console.error(`[IntegrationAgent] Error:`, error);
      sendEvent({
        type: SemanticEventName.SYSTEM_LOG as any,
        producerId: participant.getId(),
        occurredAt: new Date(),
        payload: { planId: payload.planId, message: 'Integration Phase encountered an error.', level: 'error' }
      }, participant.getId());

      // Still emit MIGRATION_COMPLETED so the UI doesn't hang forever
      sendEvent({
        type: SemanticEventName.MIGRATION_COMPLETED,
        producerId: participant.getId(),
        occurredAt: new Date(),
        payload: { planId: payload.planId },
      }, participant.getId());
    }
  },
};

const manageIntegrationHandler: SituationHandler = {
  specification: new WhenIntegrationStarts(),
  processor: integrationProcessor,
};

/**
 * Creates the IntegrationAgent instance.
 */
export function createIntegrationAgent(tools: Tool[] = []): Agent {
  return createAgent({
    name: 'IntegrationAgent',
    capabilities: ['integration_testing', 'code_repair'],
    instruction: 'You are the Integration Agent. You ensure that all files in the project work together by resolving broken imports and exports after a migration.',
    tools: tools,
    handlers: [manageIntegrationHandler],
  });
}
