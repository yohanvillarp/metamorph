import {
  Agent,
  createAgent,
  SituationContext,
  SituationSpecification,
} from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';
import { resolveRuntime, sendEvent } from '../runtime';
import { planReadyForIntegration } from './planReady';

const WATCHDOG_MS = 8000;
const WATCHDOG_MAX_MS = 30 * 60 * 1000;

class WhenSwarmMayBeIdle extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return (
      event.type === SemanticEventName.FILE_REVIEWED
      || event.type === SemanticEventName.FILE_FAILED
      || event.type === SemanticEventName.FILE_FATAL_MISMATCH
      || event.type === SemanticEventName.PHASE_PACKAGES_READY
    );
  }
}

class WhenMigrationStarted extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.MIGRATION_STARTED;
  }
}

async function emitIntegrationIfReady(producerId: string, planId: string): Promise<void> {
  const runtime = resolveRuntime();
  const plan = await runtime.state.repository.getPlan(planId);
  if (!plan || !planReadyForIntegration(plan)) return;

  console.log(`[Coordinator] File work and packages are settled. Emitting phase.integration_started.`);
  sendEvent({
    type: SemanticEventName.PHASE_INTEGRATION_STARTED,
    producerId,
    occurredAt: new Date(),
    payload: { planId },
  }, producerId);
}

function stopWatchdog(planId: string): void {
  const runtime = resolveRuntime();
  const timer = runtime.state.integrationWatchdogs.get(planId);
  if (!timer) return;
  clearInterval(timer);
  runtime.state.integrationWatchdogs.delete(planId);
}

const startIntegrationIfIdle = {
  async apply({ event, participant }: SituationContext) {
    const planId = (event.payload as { planId?: string }).planId;
    if (!planId) return;
    await emitIntegrationIfReady(participant.getId(), planId);
  },
};

const startWatchdogProcessor = {
  async apply({ event, participant }: SituationContext) {
    const p = event.payload as SemanticEventPayloads.MigrationStarted;
    const runtime = resolveRuntime();
    stopWatchdog(p.planId);

    const startedAt = Date.now();
    const producerId = participant.getId();

    sendEvent({
      type: SemanticEventName.SYSTEM_LOG as any,
      producerId,
      occurredAt: new Date(),
      payload: {
        planId: p.planId,
        message: 'Coordinator watchdog is on: if file work settles and Integration never starts, it will kick within 8s. No extra model calls.',
        level: 'info',
      },
    }, producerId);

    const timer = setInterval(async () => {
      try {
        const plan = await runtime.state.repository.getPlan(p.planId);
        if (!plan || plan.phase === 'completed' || plan.phase === 'failed') {
          stopWatchdog(p.planId);
          return;
        }
        if (Date.now() - startedAt >= WATCHDOG_MAX_MS) {
          stopWatchdog(p.planId);
          sendEvent({
            type: SemanticEventName.SYSTEM_LOG as any,
            producerId,
            occurredAt: new Date(),
            payload: {
              planId: p.planId,
              message: 'Coordinator watchdog stopped after 30 minutes. Integration never became ready (files still in progress, or the run stalled).',
              level: 'warning',
            },
          }, producerId);
          return;
        }
        await emitIntegrationIfReady(producerId, p.planId);
      } catch (error) {
        console.error('[Coordinator] Watchdog tick failed:', error);
      }
    }, WATCHDOG_MS);

    runtime.state.integrationWatchdogs.set(p.planId, timer);
  },
};

/**
 * Reacts when the swarm is idle enough to build. Does not call the model.
 * Watchdog re-checks the plan so a missed file.reviewed cannot stall npm install.
 */
export function createCoordinatorAgent(): Agent {
  return createAgent({
    name: 'Coordinator',
    capabilities: [],
    instruction: 'You watch the bus and start Integration when file tasks and packages are settled. You do not call the model.',
    tools: [],
    handlers: [
      { specification: new WhenMigrationStarted(), processor: startWatchdogProcessor },
      { specification: new WhenSwarmMayBeIdle(), processor: startIntegrationIfIdle },
    ],
  });
}
