/**
 * Pure domain representation of the system runtime and swarm configuration.
 * Adheres strictly to Hexagonal Zero-I/O Invariant: zero external dependencies or filesystem operations.
 */
export interface MetamorphConfig {
  /** Default LLM model identifier for worker, reviewer, and integration tasks. */
  model: string;
  /** Optional distinct LLM model identifier specifically for the reviewer agent. */
  reviewerModel?: string;
  /** Maximum number of concurrent worker/reviewer agent executions (default: 3). */
  concurrency: number;
  /** Inference timeout per file transformation loop in milliseconds (default: 120000 / 2 min). */
  inferenceTimeoutMs: number;
  /** Maximum repair retry attempts before marking a file task as failed (default: 2). */
  maxRetries: number;
  /** Maximum integration verification rounds in the shadow workspace (default: 4). */
  maxIntegrationRounds: number;
}

export type MetamorphConfigKey = keyof MetamorphConfig;

/**
 * Deterministic default configuration values for Metamorph swarm execution.
 */
export const DEFAULT_METAMORPH_CONFIG: MetamorphConfig = {
  model: 'gpt-5.4',
  concurrency: 3,
  inferenceTimeoutMs: 120000,
  maxRetries: 2,
  maxIntegrationRounds: 4,
};

/**
 * Officially bundled and verified model identifiers supported by Mozaik v4 runtime.
 * Ref: https://docs.jigjoy.ai/docs/models#bundled-names
 */
export const MOZAIK_BUNDLED_MODELS = [
  // OpenAI
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'gpt-5.5',
  // Anthropic
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-opus-4-7',
  'claude-opus-4-8',
] as const;

export type MozaikBundledModel = (typeof MOZAIK_BUNDLED_MODELS)[number];

export function isMozaikBundledModel(model: string): model is MozaikBundledModel {
  return (MOZAIK_BUNDLED_MODELS as readonly string[]).includes(model);
}

/**
 * Validates whether a key belongs to MetamorphConfig.
 */
export function isMetamorphConfigKey(key: string): key is MetamorphConfigKey {
  return [
    'model',
    'reviewerModel',
    'concurrency',
    'inferenceTimeoutMs',
    'maxRetries',
    'maxIntegrationRounds',
  ].includes(key);
}
