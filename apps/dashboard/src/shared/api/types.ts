export interface TaskItem {
  filePath: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface MigrationEventItem {
  id: number;
  eventName: string;
  payload?: Record<string, unknown>;
  timestamp: string | Date;
  producerId?: string;
}

export interface MigrationPlan {
  id: string;
  runId: string;
  sourceFramework: string;
  targetFramework: string;
  targetPath: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  phase?: 'files' | 'integration' | 'completed' | 'failed';
  outcome?: 'success' | 'failed';
  appliedAt?: string;
  appliedBranch?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalFiles: number;
  migratedFiles: number;
  createdAt: string;
  tasks: TaskItem[];
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
  byAgentRole: Record<string, AgentRoleCost>;
  byModel: Record<string, ModelCostBreakdown>;
}

export interface StartMigrationResponse {
  runId?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ApplyMigrationResponse {
  gitUsed: boolean;
  branch?: string;
  message: string;
}
