import { StateRepository } from '@nikelyh/domain';
import { MetamorphState, initializeRuntime, join, sendEvent } from './runtime';
import { createMapperAgent } from './agents/MapperAgent';
import { createWorkerAgent } from './agents/WorkerAgent';
import { createReviewerAgent } from './agents/ReviewerAgent';

import { Tool } from '@mozaik-ai/core';

/**
 * Bootstraps the Mozaik Application Layer.
 * @param repository The Infrastructure implementation (SQLite) injected from CLI.
 * @param tools The function tools (e.g. AST) provided by Infrastructure.
 */
export function bootstrapMetamorph(repository: StateRepository, tools: Tool[] = []) {
  // 1. Initialize the global Mozaik runtime with our SQLite repository
  initializeRuntime({
    state: new MetamorphState(repository),
  });

  // 2. Instantiate our agents
  const mapper = createMapperAgent();
  const worker = createWorkerAgent(tools);
  const reviewer = createReviewerAgent(tools);

  // 3. Connect them to the Event Bus
  join(mapper);
  join(worker);
  join(reviewer);

  console.log(`[App] Mozaik initialized. Agents joined: ${mapper.getId()} (Mapper), ${worker.getId()} (Worker), ${reviewer.getId()} (Reviewer)`);

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
