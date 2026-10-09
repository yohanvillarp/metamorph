import {
  AgentRole,
  calculateTokenCost,
  MigrationCostSummary,
  SemanticEventName,
  SemanticEventPayloads,
  StateRepository,
  TokenUsage,
  TokenUsageRecord,
} from '@nikelyh/domain';
import { sendEvent } from '../runtime';

export interface RecordUsageParams {
  planId: string;
  runId?: string;
  agentRole: AgentRole;
  modelId: string;
  tokenUsage?: TokenUsage | null;
  promptText?: string;
  completionText?: string;
  producerId?: string;
}

/**
 * Service for calculating, persisting, and broadcasting LLM token consumption and costs.
 * Orchestrated asynchronously inside the Application layer.
 */
export class TokenAccountingService {
  private repository: StateRepository;

  constructor(repository: StateRepository) {
    this.repository = repository;
  }

  async recordUsage(params: RecordUsageParams): Promise<TokenUsageRecord> {
    const {
      planId,
      agentRole,
      modelId,
      tokenUsage,
      promptText,
      completionText,
      producerId = `Accounting-${Date.now()}`,
    } = params;

    let runId = params.runId;
    if (!runId && planId) {
      try {
        const plan = await this.repository.getPlan(planId);
        runId = plan?.runId || planId;
      } catch {
        runId = planId;
      }
    }
    if (!runId) {
      runId = 'default-run';
    }

    let promptTokens = tokenUsage?.promptTokens ?? 0;
    let completionTokens = tokenUsage?.completionTokens ?? 0;

    // Fallback: estimate tokens if provider does not return tokenUsage
    if (promptTokens === 0 && promptText) {
      promptTokens = Math.max(1, Math.ceil(promptText.length / 4));
    }
    if (completionTokens === 0 && completionText) {
      completionTokens = Math.max(1, Math.ceil(completionText.length / 4));
    }

    const totalTokens = promptTokens + completionTokens;
    const costUsd = calculateTokenCost(modelId, promptTokens, completionTokens);

    const record: TokenUsageRecord = {
      runId,
      planId,
      agentRole,
      modelId,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
      timestamp: new Date(),
    };

    await this.repository.recordTokenUsage(record);

    // Emit semantic event to Mozaik event bus for subscribers (Dashboard SSE, Telemetry)
    try {
      sendEvent({
        type: SemanticEventName.TOKENS_CONSUMED,
        producerId,
        occurredAt: record.timestamp || new Date(),
        payload: {
          planId,
          runId,
          agentRole,
          modelId,
          promptTokens,
          completionTokens,
          totalTokens,
          costUsd,
        } as SemanticEventPayloads.TokensConsumed,
      }, producerId);
    } catch {
      // Ignored if runtime event bus is uninitialized or in isolated test
    }

    return record;
  }

  async getCostSummary(runId: string): Promise<MigrationCostSummary> {
    return this.repository.getCostSummary(runId);
  }
}
