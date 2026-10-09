import { MOZAIK_BUNDLED_MODELS, MozaikBundledModel } from './MetamorphConfig';

/**
 * Pure domain representation of model pricing rates.
 * Prices are measured in USD per 1 Million tokens.
 * Zero-I/O Invariant: Pure calculation logic with deterministic defaults.
 */
export interface ModelPricingTier {
  modelId: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  currency: 'USD';
}

/**
 * Standard baseline pricing catalog for officially supported Mozaik v4 bundled models.
 * Rates in USD per 1,000,000 tokens (input / output).
 */
export const BUNDLED_MODEL_PRICING: Record<MozaikBundledModel, ModelPricingTier> = {
  // OpenAI
  'gpt-5.4': {
    modelId: 'gpt-5.4',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00,
    currency: 'USD',
  },
  'gpt-5.4-mini': {
    modelId: 'gpt-5.4-mini',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    currency: 'USD',
  },
  'gpt-5.4-nano': {
    modelId: 'gpt-5.4-nano',
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.20,
    currency: 'USD',
  },
  'gpt-5.5': {
    modelId: 'gpt-5.5',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 12.00,
    currency: 'USD',
  },
  // Anthropic
  'claude-sonnet-4-6': {
    modelId: 'claude-sonnet-4-6',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    currency: 'USD',
  },
  'claude-haiku-4-5': {
    modelId: 'claude-haiku-4-5',
    inputPricePerMillion: 0.80,
    outputPricePerMillion: 4.00,
    currency: 'USD',
  },
  'claude-opus-4-7': {
    modelId: 'claude-opus-4-7',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    currency: 'USD',
  },
  'claude-opus-4-8': {
    modelId: 'claude-opus-4-8',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    currency: 'USD',
  },
};

/**
 * Resolves the pricing tier for a given model ID.
 * Falls back to $0.00 USD for unrecognized or local models (e.g., Ollama, vLLM).
 */
export function resolvePricingTier(
  modelId: string,
  customPricing?: Record<string, ModelPricingTier>
): ModelPricingTier {
  if (customPricing && customPricing[modelId]) {
    return customPricing[modelId];
  }

  if (modelId in BUNDLED_MODEL_PRICING) {
    return BUNDLED_MODEL_PRICING[modelId as MozaikBundledModel];
  }

  // Fallback for local / custom models: 0.00 USD
  return {
    modelId,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    currency: 'USD',
  };
}

/**
 * Pure calculation of token cost in USD based on input and output token counts.
 * Returns cost rounded to 6 decimal places to prevent floating-point drift.
 */
export function calculateTokenCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  customPricing?: Record<string, ModelPricingTier>
): number {
  const tier = resolvePricingTier(modelId, customPricing);
  const inputCost = (promptTokens / 1_000_000) * tier.inputPricePerMillion;
  const outputCost = (completionTokens / 1_000_000) * tier.outputPricePerMillion;
  const totalCost = inputCost + outputCost;

  return Math.round(totalCost * 1_000_000) / 1_000_000;
}
