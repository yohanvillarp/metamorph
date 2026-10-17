import { TokenUsage } from '../entities/TokenUsage';

export interface WorkerInferenceRequest {
  planId: string;
  filePath: string;
  prompt: string;
  modelId: string;
  timeoutMs: number;
  shadowRoot?: string;
  sourceFramework?: string;
  targetFramework?: string;
}

export interface WorkerInferenceResponse {
  success: boolean;
  tokenUsage: TokenUsage;
  completionContent?: string;
  error?: string;
}

export interface ReviewerInferenceRequest {
  planId: string;
  filePath: string;
  prompt: string;
  diff: string;
  modelId: string;
  timeoutMs: number;
  sourceFramework?: string;
  targetFramework?: string;
}

export interface ReviewerInferenceResponse {
  status: 'APPROVED' | 'REJECTED' | 'FATAL_MISMATCH';
  errors: string[];
  tokenUsage: TokenUsage;
  rawAnswerText?: string;
}

/**
 * Secondary Port:
 * Hexagonal contract that defines how LLM inference and code generation are executed.
 * Decouples the application layer from specific LLM providers (Mozaik, OpenAI, Mock, etc.).
 * Zero-I/O Invariant: Pure interface contract with zero external dependencies.
 */
export interface InferencePort {
  runWorkerInference(request: WorkerInferenceRequest): Promise<WorkerInferenceResponse>;
  runReviewerInference(request: ReviewerInferenceRequest): Promise<ReviewerInferenceResponse>;
}
