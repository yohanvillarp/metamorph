import {
  Agent,
  createAgent,
  SituationContext,
  SituationSpecification,
} from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';
import { resolveRuntime } from '../runtime';
import { TokenAccountingService } from '../accounting/TokenAccountingService';

class WhenTokensReportedSpecification extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.TOKENS_REPORTED;
  }
}

/**
 * Mozaik v4 Reactive Agent for token accounting and cost estimation.
 * Subscribes to `tokens.reported` events emitted by inference runners, calculates
 * exact token usage and financial cost, persists to SQLite, and emits `tokens.consumed`.
 */
export function createAccountingAgent(): Agent {
  return createAgent({
    name: 'AccountingAgent',
    capabilities: ['accounting', 'telemetry'],
    instruction: 'You reactively account for token consumption and estimate costs.',
    tools: [],
    handlers: [
      {
        specification: new WhenTokensReportedSpecification(),
        processor: {
          async apply({ event }) {
            const payload = event.payload as SemanticEventPayloads.TokensReported;
            if (!payload || !payload.planId) return;

            try {
              const runtime = resolveRuntime();
              const repository = runtime.state.repository;
              const service = new TokenAccountingService(repository);
              await service.recordUsage({
                planId: payload.planId,
                runId: payload.runId,
                agentRole: payload.agentRole,
                modelId: payload.modelId,
                tokenUsage: payload.tokenUsage,
                promptText: payload.promptText,
                completionText: payload.completionText,
                producerId: event.producerId,
              });
            } catch (error) {
              console.error('[AccountingAgent] Error processing token accounting:', error);
            }
          },
        },
      },
    ],
  });
}
