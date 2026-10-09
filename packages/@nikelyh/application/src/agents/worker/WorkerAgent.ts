import {
  Agent,
  createAgent,
  SituationContext,
  SituationSpecification,
  Tool,
} from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';
import { resolveRuntime, sendEvent } from '../../runtime';
import { ConcurrencyQueue } from '../../concurrency/ConcurrencyQueue';
import { buildWorkOnFilePrompt, buildFixRejectedPrompt } from './WorkerPromptBuilder';
import { startWorkerLoop } from './WorkerInferenceRunner';

const DEFAULT_MAX_RETRIES = 2;
export const workerQueue = new ConcurrencyQueue(3);

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

class WhenFileFatalMismatch extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_FATAL_MISMATCH;
  }
}

function syncQueueLimit(): void {
  const runtime = resolveRuntime();
  if (runtime.state.config && workerQueue.getLimit() !== runtime.state.config.concurrency) {
    workerQueue.setLimit(runtime.state.config.concurrency);
  }
}

const workOnFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileDiscovered;
    console.log(`[WorkerAgent] Received file to migrate: ${payload.filePath}`);
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(payload.planId);
    const prompt = buildWorkOnFilePrompt(payload.filePath, plan);

    syncQueueLimit();
    workerQueue.enqueue(async () => {
      await startWorkerLoop(payload.planId, payload.filePath, prompt, participant as Agent);
    });
  },
};

const fixRejectedFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileRejected;
    const retryKey = `${payload.planId}:${payload.filePath}`;
    const retries = resolveRuntime().state.retryCounts;
    if (payload.source === 'integration') {
      retries.delete(retryKey);
    }
    const currentRetries = retries.get(retryKey) || 0;
    const runtime = resolveRuntime();
    const maxRetries = runtime.state.config?.maxRetries ?? DEFAULT_MAX_RETRIES;

    if (currentRetries >= maxRetries) {
      console.warn(`[WorkerAgent] File ${payload.filePath} exceeded max retries (${maxRetries}). Marking as failed.`);
      await runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'failed', `Exceeded max retries (${maxRetries})`);
      retries.delete(retryKey);
      sendEvent({
        type: SemanticEventName.FILE_FAILED,
        producerId: participant.getId(),
        occurredAt: new Date(),
        payload: { planId: payload.planId, filePath: payload.filePath, reason: `Exceeded max retries (${maxRetries})` },
      }, participant.getId());
      return;
    }

    retries.set(retryKey, currentRetries + 1);
    console.log(`[WorkerAgent] File REJECTED (attempt ${currentRetries + 1}/${maxRetries}), initiating repair loop: ${payload.filePath}`);

    const plan = await runtime.state.repository.getPlan(payload.planId);
    const prompt = buildFixRejectedPrompt({
      filePath: payload.filePath,
      errors: payload.errors,
      source: payload.source,
      plan,
    });

    workerQueue.enqueue(async () => {
      await startWorkerLoop(payload.planId, payload.filePath, prompt, participant as Agent);
    });
  },
};

const fatalMismatchProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileFatalMismatch;
    console.error(`[WorkerAgent] 🛑 FATAL MISMATCH received for ${payload.filePath}. Reason: ${payload.reason}`);

    const retryKey = `${payload.planId}:${payload.filePath}`;
    resolveRuntime().state.retryCounts.delete(retryKey);

    const runtime = resolveRuntime();
    await runtime.state.repository.updateTaskStatus(
      payload.planId,
      payload.filePath,
      'failed',
      `Fatal Architectural Mismatch: ${payload.reason}`
    );
    sendEvent({
      type: SemanticEventName.FILE_FAILED,
      producerId: participant.getId(),
      occurredAt: new Date(),
      payload: { planId: payload.planId, filePath: payload.filePath, reason: payload.reason },
    }, participant.getId());
  },
};

export function createWorkerAgent(tools: Tool[]): Agent {
  return createAgent({
    name: 'Worker',
    capabilities: ['code_refactoring', 'inference'],
    instruction: 'You are the Programmer Worker. You migrate code and adapt file structures.',
    tools: tools,
    handlers: [
      { specification: new WhenFileDiscovered(), processor: workOnFileProcessor },
      { specification: new WhenFileRejected(), processor: fixRejectedFileProcessor },
      { specification: new WhenFileFatalMismatch(), processor: fatalMismatchProcessor },
    ],
  });
}
