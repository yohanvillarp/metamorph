import { StateRepository } from '@nikelyh/domain';
import { MetamorphState, initializeRuntime, join, sendEvent } from './runtime';
import { createMapperAgent } from './agents/MapperAgent';
import { createWorkerAgent } from './agents/WorkerAgent';
import { createReviewerAgent } from './agents/ReviewerAgent';
import { createPackageManagerAgent } from './agents/PackageManagerAgent';
import { createReporterAgent } from './agents/ReporterAgent';
import { createIntegrationAgent } from './agents/IntegrationAgent';

import { Tool, createAgent, SituationSpecification, supportedModels } from '@mozaik-ai/core';

/**
 * Bootstraps the Mozaik Application Layer.
 * @param repository The Infrastructure implementation (SQLite) injected from CLI.
 * @param tools The function tools (e.g. AST) provided by Infrastructure.
 */
export function bootstrapMetamorph(repository: StateRepository, tools: Tool[] = []) {
  // 1. Initialize the global Mozaik runtime with our SQLite repository
  initializeRuntime({
    state: new MetamorphState(repository)
  });

  // 1.5. Add Telemetry Logger Agent to intercept ALL events and write to DB
  class AllEventsSpecification extends SituationSpecification {
    isSatisfiedBy(): boolean {
      return true;
    }
  }

  const loggerAgent = createAgent({
    name: 'TelemetryLogger',
    capabilities: [],
    instruction: 'You silently log everything.',
    tools: [],
    handlers: [
      {
        specification: new AllEventsSpecification(),
        processor: {
          async apply({ event }) {
            const { resolveRuntime } = await import('./runtime');
            const runtime = resolveRuntime();
            const repository = runtime.state.repository;
            
            // Only log our semantic events, ignore internal 'inference.*' noise
            if (event.type.includes('migration') || event.type.includes('file') || event.type.includes('phase')) {
              await repository.logEvent(event.type, { 
                ...(event.payload as Record<string, unknown>), 
                producerId: event.producerId 
              });
            }
          }
        }
      }
    ]
  });
  join(loggerAgent);

  // 2. Instantiate our agents
  const mapper = createMapperAgent();
  const worker = createWorkerAgent(tools);
  const reviewer = createReviewerAgent(tools);
  const packageManager = createPackageManagerAgent();
  const reporter = createReporterAgent();
  
  // Create integration agent and give it all AST tools (plus the linter tool which we'll add in CLI)
  const integrationAgent = createIntegrationAgent();
  for (const t of tools) integrationAgent.addTool(t);

  // 3. Connect them to the Event Bus
  join(mapper);
  join(worker);
  join(reviewer);
  join(packageManager);
  join(reporter);
  join(integrationAgent);

  console.log(`[App] Mozaik initialized. Agents joined: Mapper, Worker, Reviewer, PackageManager, Reporter, IntegrationAgent`);

  return {
    mapperId: mapper.getId(),
    workerId: worker.getId(),
    reviewerId: reviewer.getId(),
  };
}

export * from './runtime';
export * from './agents/MapperAgent';
export * from './agents/WorkerAgent';
export * from './agents/ReviewerAgent';
export * from './agents/PackageManagerAgent';
export * from './agents/ReporterAgent';
export * from './agents/IntegrationAgent';
export * from './MigrationRunner';
