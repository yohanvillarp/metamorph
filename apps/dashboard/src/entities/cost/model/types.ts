export interface AgentRoleCost {
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  executions: number;
}

export interface ModelCostBreakdown {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface MigrationCostSummary {
  runId: string;
  planId: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostUsd: number;
  byAgentRole: Record<string, AgentRoleCost>;
  byModel: Record<string, ModelCostBreakdown>;
}
