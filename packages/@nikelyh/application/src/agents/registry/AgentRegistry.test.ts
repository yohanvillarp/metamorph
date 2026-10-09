import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_METAMORPH_CONFIG, MetamorphConfig } from '@nikelyh/domain';
import { AgentRegistry, AGENT_DESCRIPTORS } from './AgentRegistry';

describe('AgentRegistry - Swarm Registration & Configurable Disabling', () => {
  test('registers all 8 standard Metamorph swarm agents', () => {
    const descriptors = AgentRegistry.getAllDescriptors();
    assert.strictEqual(descriptors.length, 8);

    const ids = descriptors.map((d) => d.id);
    assert.ok(ids.includes('mapper'));
    assert.ok(ids.includes('worker'));
    assert.ok(ids.includes('reviewer'));
    assert.ok(ids.includes('packagemanager'));
    assert.ok(ids.includes('coordinator'));
    assert.ok(ids.includes('reporter'));
    assert.ok(ids.includes('integration'));
    assert.ok(ids.includes('accounting'));
  });

  test('correctly partitions core vs auxiliary categories', () => {
    const coreDescriptors = AGENT_DESCRIPTORS.filter((d) => d.category === 'core');
    const auxDescriptors = AGENT_DESCRIPTORS.filter((d) => d.category === 'auxiliary');

    assert.strictEqual(coreDescriptors.length, 5);
    assert.strictEqual(auxDescriptors.length, 3);

    assert.deepStrictEqual(
      coreDescriptors.map((d) => d.id).sort(),
      ['coordinator', 'integration', 'mapper', 'packagemanager', 'worker'].sort()
    );
    assert.deepStrictEqual(
      auxDescriptors.map((d) => d.id).sort(),
      ['accounting', 'reporter', 'reviewer'].sort()
    );
  });

  test('isAgentDisabled returns false by default', () => {
    assert.strictEqual(AgentRegistry.isAgentDisabled('reporter', DEFAULT_METAMORPH_CONFIG), false);
    assert.strictEqual(AgentRegistry.isAgentDisabled('reviewer', DEFAULT_METAMORPH_CONFIG), false);
    assert.strictEqual(AgentRegistry.isAgentDisabled('worker', DEFAULT_METAMORPH_CONFIG), false);
  });

  test('isAgentDisabled never disables core agents even if specified', () => {
    const config: MetamorphConfig = {
      ...DEFAULT_METAMORPH_CONFIG,
      disabledAgents: ['worker' as any],
    };
    assert.strictEqual(AgentRegistry.isAgentDisabled('worker', config), false);
    assert.strictEqual(AgentRegistry.isAgentDisabled('coordinator', config), false);
  });

  test('resolveSwarmAgents joins all primary agents when none are disabled', () => {
    const { agentsToJoin, disabledAgents } = AgentRegistry.resolveSwarmAgents({
      tools: [],
      config: DEFAULT_METAMORPH_CONFIG,
    });

    assert.strictEqual(disabledAgents.length, 0);
    assert.strictEqual(agentsToJoin.length, 8);
    const names = agentsToJoin.map((a) => a.getManifest().name);
    assert.ok(names.includes('Reporter'));
    assert.ok(names.includes('Reviewer'));
    assert.ok(names.includes('AccountingAgent'));
  });

  test('resolveSwarmAgents activates FallbackReporter when reporter is disabled', () => {
    const config: MetamorphConfig = {
      ...DEFAULT_METAMORPH_CONFIG,
      disabledAgents: ['reporter'],
    };

    const { agentsToJoin, disabledAgents } = AgentRegistry.resolveSwarmAgents({
      tools: [],
      config,
    });

    assert.strictEqual(disabledAgents.length, 1);
    assert.strictEqual(disabledAgents[0].id, 'reporter');

    const names = agentsToJoin.map((a) => a.getManifest().name);
    assert.ok(!names.includes('Reporter'));
    assert.ok(names.includes('FallbackReporter'));
  });

  test('resolveSwarmAgents activates ReviewerBypass when reviewer is disabled', () => {
    const config: MetamorphConfig = {
      ...DEFAULT_METAMORPH_CONFIG,
      disabledAgents: ['reviewer'],
    };

    const { agentsToJoin, disabledAgents } = AgentRegistry.resolveSwarmAgents({
      tools: [],
      config,
    });

    assert.strictEqual(disabledAgents.length, 1);
    assert.strictEqual(disabledAgents[0].id, 'reviewer');

    const names = agentsToJoin.map((a) => a.getManifest().name);
    assert.ok(!names.includes('Reviewer'));
    assert.ok(names.includes('ReviewerBypass'));
  });

  test('resolveSwarmAgents omits AccountingAgent when accounting is disabled', () => {
    const config: MetamorphConfig = {
      ...DEFAULT_METAMORPH_CONFIG,
      disabledAgents: ['accounting'],
    };

    const { agentsToJoin, disabledAgents } = AgentRegistry.resolveSwarmAgents({
      tools: [],
      config,
    });

    assert.strictEqual(disabledAgents.length, 1);
    assert.strictEqual(disabledAgents[0].id, 'accounting');

    const names = agentsToJoin.map((a) => a.getManifest().name);
    assert.ok(!names.includes('AccountingAgent'));
    assert.strictEqual(agentsToJoin.length, 7);
  });
});
