import { StateRepository } from '@nikelyh/domain';
import { MetamorphState, initializeRuntime, join, sendEvent } from './runtime';
import { createMapperAgent } from './agents/MapperAgent';
import { createWorkerAgent } from './agents/WorkerAgent';

/**
 * Bootstraps the Mozaik Application Layer.
 * @param repository The Infrastructure implementation (SQLite) injected from CLI.
 */
export function bootstrapMetamorph(repository: StateRepository) {
  // 1. Initialize the global Mozaik runtime with our SQLite repository
  initializeRuntime({
    state: new MetamorphState(repository),
  });

  // 2. Instantiate our agents
  const mapper = createMapperAgent();
  const worker = createWorkerAgent();

  // 3. Connect them to the Event Bus
  join(mapper);
  join(worker);

  console.log(`[App] Mozaik initialized. Agents joined: ${mapper.getId()} (Mapper), ${worker.getId()} (Worker)`);

  return {
    mapperId: mapper.getId(),
    workerId: worker.getId(),
  };
}

export * from './runtime';
export * from './agents/MapperAgent';
export * from './agents/WorkerAgent';
