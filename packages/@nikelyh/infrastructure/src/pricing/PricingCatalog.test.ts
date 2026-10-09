import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTokenCost,
  resolvePricingTier,
  BUNDLED_MODEL_PRICING,
  MOZAIK_BUNDLED_MODELS,
} from '@nikelyh/domain';

describe('PricingCatalog & Cost Estimation', () => {
  test('resolves bundled models with exact pricing tiers', () => {
    for (const model of MOZAIK_BUNDLED_MODELS) {
      const tier = resolvePricingTier(model);
      assert.equal(tier.modelId, model);
      assert.ok(tier.inputPricePerMillion >= 0);
      assert.ok(tier.outputPricePerMillion >= 0);
      assert.equal(tier.currency, 'USD');
    }
  });

  test('falls back to 0.00 USD for unknown or local models (Ollama/vLLM)', () => {
    const tier = resolvePricingTier('llama-3.3-70b-local');
    assert.equal(tier.modelId, 'llama-3.3-70b-local');
    assert.equal(tier.inputPricePerMillion, 0);
    assert.equal(tier.outputPricePerMillion, 0);

    const cost = calculateTokenCost('llama-3.3-70b-local', 50000, 10000);
    assert.equal(cost, 0);
  });

  test('calculates token cost accurately for gpt-5.4', () => {
    // gpt-5.4 rates: $2.50 input / $10.00 output per 1M tokens
    // 100,000 prompt tokens = $0.25
    // 20,000 completion tokens = $0.20
    // Total = $0.45
    const cost = calculateTokenCost('gpt-5.4', 100000, 20000);
    assert.equal(cost, 0.45);
  });

  test('calculates token cost accurately for claude-sonnet-4-6', () => {
    // claude-sonnet-4-6: $3.00 input / $15.00 output per 1M tokens
    // 50,000 prompt tokens = $0.15
    // 10,000 completion tokens = $0.15
    // Total = $0.30
    const cost = calculateTokenCost('claude-sonnet-4-6', 50000, 10000);
    assert.equal(cost, 0.30);
  });

  test('supports custom pricing overrides', () => {
    const customPricing = {
      'custom-fine-tuned': {
        modelId: 'custom-fine-tuned',
        inputPricePerMillion: 1.00,
        outputPricePerMillion: 2.00,
        currency: 'USD' as const,
      },
    };

    const cost = calculateTokenCost('custom-fine-tuned', 1_000_000, 500_000, customPricing);
    assert.equal(cost, 2.00); // 1.00 + 1.00
  });
});
