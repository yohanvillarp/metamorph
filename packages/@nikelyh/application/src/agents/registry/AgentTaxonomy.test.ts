import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCoreAgentId,
  isAuxiliaryAgentId,
  validateDisabledAgents,
} from '@nikelyh/domain';

describe('AgentTaxonomy - Pure Domain Entity & Validation', () => {
  test('correctly identifies core and auxiliary agents', () => {
    assert.strictEqual(isCoreAgentId('worker'), true);
    assert.strictEqual(isCoreAgentId('coordinator'), true);
    assert.strictEqual(isCoreAgentId('mapper'), true);
    assert.strictEqual(isCoreAgentId('packagemanager'), true);
    assert.strictEqual(isCoreAgentId('integration'), true);
    assert.strictEqual(isCoreAgentId('reporter'), false);

    assert.strictEqual(isAuxiliaryAgentId('reporter'), true);
    assert.strictEqual(isAuxiliaryAgentId('reviewer'), true);
    assert.strictEqual(isAuxiliaryAgentId('accounting'), true);
    assert.strictEqual(isAuxiliaryAgentId('worker'), false);
    assert.strictEqual(isAuxiliaryAgentId('unknown_agent'), false);
  });

  test('validates valid auxiliary agents list', () => {
    const result = validateDisabledAgents(['reporter', 'reviewer']);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.disabled, ['reporter', 'reviewer']);
    assert.strictEqual(result.error, undefined);
  });

  test('normalizes casing and trims whitespace', () => {
    const result = validateDisabledAgents(['  REPORTER  ', 'Reviewer ']);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.disabled, ['reporter', 'reviewer']);
  });

  test('deduplicates duplicate auxiliary agent entries', () => {
    const result = validateDisabledAgents(['reporter', 'reporter', 'reviewer']);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.disabled, ['reporter', 'reviewer']);
  });

  test('rejects attempt to disable core agent with descriptive error', () => {
    const result = validateDisabledAgents(['reporter', 'worker']);
    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.disabled, []);
    assert.match(result.error || '', /Cannot disable core agent 'worker'/);
  });

  test('rejects unknown agent with available list', () => {
    const result = validateDisabledAgents(['non_existent_agent']);
    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.disabled, []);
    assert.match(result.error || '', /Unknown agent 'non_existent_agent'/);
  });

  test('handles empty input gracefully', () => {
    const result = validateDisabledAgents([]);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.disabled, []);
  });
});
