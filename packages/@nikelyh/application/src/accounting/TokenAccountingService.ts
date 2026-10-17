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
  isMock?: boolean;
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
    let plan = null;
    if (planId) {
      try {
        plan = await this.repository.getPlan(planId);
        if (!runId) {
          runId = plan?.runId || planId;
        }
      } catch {
        if (!runId) {
          runId = planId;
        }
      }
    }
    if (!runId) {
      runId = 'default-run';
    }

    const isMock = Boolean(
      params.isMock ||
      modelId === 'mock' ||
      (plan && plan.isMock)
    );

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
    const costUsd = isMock ? 0 : calculateTokenCost(modelId, promptTokens, completionTokens);

    const record: TokenUsageRecord = {
      runId,
      planId,
      agentRole,
      modelId,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
      isMock,
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
          isMock,
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
