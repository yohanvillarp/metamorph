import { StateRepository, MetamorphConfig } from '@nikelyh/domain';
import { MetamorphState, initializeRuntime, join, resolveRuntime } from './runtime';
import { registerBuiltinMigrationPlugins } from './migration/plugins';
import { AgentRegistry } from './agents/registry/AgentRegistry';

import { Tool, createAgent, createHuman, SituationSpecification } from '@mozaik-ai/core';

/**
 * Bootstraps the Mozaik Application Layer.
 * @param repository The Infrastructure implementation (SQLite) injected from CLI.
 * @param tools The function tools (e.g. AST) provided by Infrastructure.
 * @param config Optional resolved swarm runtime configuration.
 */
export function bootstrapMetamorph(repository: StateRepository, tools: Tool[] = [], config?: MetamorphConfig) {
  registerBuiltinMigrationPlugins();

  // 1. Initialize the global Mozaik runtime with our SQLite repository and config
  initializeRuntime({
    state: new MetamorphState(repository, config)
  });

  const dispatcher = createHuman({ name: 'System', capabilities: [], handlers: [] });
  join(dispatcher);
  resolveRuntime().state.dispatcherId = dispatcher.getId();

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
            if (event.type.includes('migration') || event.type.includes('file') || event.type.includes('phase') || event.type.includes('system') || event.type.includes('tokens')) {
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

  // 2. Instantiate and join our swarm agents via AgentRegistry
  const { agentsToJoin, disabledAgents } = AgentRegistry.resolveSwarmAgents({ tools, config });
  for (const agent of agentsToJoin) {
    join(agent);
  }

  const joinedNames = agentsToJoin.map((a) => a.getManifest().name).join(', ');
  console.log(`[App] Mozaik initialized. Agents joined: ${joinedNames}`);
  if (disabledAgents.length > 0) {
    console.log(`[App] Disabled agents: ${disabledAgents.map((d) => `${d.id} (${d.mode})`).join(', ')}`);
  }

  const mapperAgent = agentsToJoin.find((a) => a.getManifest().name === 'Mapper');
  const workerAgent = agentsToJoin.find((a) => a.getManifest().name === 'Worker');
  const reviewerAgent = agentsToJoin.find((a) => a.getManifest().name.startsWith('Reviewer'));

  return {
    mapperId: mapperAgent?.getId() || '',
    workerId: workerAgent?.getId() || '',
    reviewerId: reviewerAgent?.getId() || '',
  };
}

export * from './runtime';
export * from './agents/registry/AgentRegistry';
export * from './agents/MapperAgent';
export * from './agents/WorkerAgent';
export * from './agents/ReviewerAgent';
export * from './agents/PackageManagerAgent';
export * from './agents/CoordinatorAgent';
export * from './agents/ReporterAgent';
export * from './agents/IntegrationAgent';
export * from './agents/AccountingAgent';
export * from './accounting/TokenAccountingService';
export * from './MigrationRunner';

