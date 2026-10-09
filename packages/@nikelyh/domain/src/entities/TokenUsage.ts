/**
 * Pure domain representation of LLM token consumption and financial accounting.
 * Adheres strictly to Hexagonal Zero-I/O Invariant: zero external dependencies, filesystem, or network operations.
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type AgentRole = 'worker' | 'reviewer' | 'integration' | 'coordinator' | 'mapper';

export interface TokenUsageRecord {
  runId: string;
  planId: string;
  agentRole: AgentRole;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  timestamp?: Date;
}

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
  byAgentRole: Record<AgentRole, AgentRoleCost>;
  byModel: Record<string, ModelCostBreakdown>;
}

export function createEmptyAgentRoleCost(): AgentRoleCost {
  return {
    tokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    costUsd: 0,
    executions: 0,
  };
}

export function createEmptyMigrationCostSummary(runId: string = '', planId: string = ''): MigrationCostSummary {
  return {
    runId,
    planId,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalCostUsd: 0,
    byAgentRole: {
      worker: createEmptyAgentRoleCost(),
      reviewer: createEmptyAgentRoleCost(),
      integration: createEmptyAgentRoleCost(),
      coordinator: createEmptyAgentRoleCost(),
      mapper: createEmptyAgentRoleCost(),
    },
    byModel: {},
  };
}
