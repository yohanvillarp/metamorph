import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMigrationCatalog, composeRuleSections, formatCatalogRules } from './compose';
import { ALL_MIGRATION_RULES } from './layers/all';
import { BACKEND_LAYER_RULES } from './layers/backend';
import { FRONTEND_LAYER_RULES } from './layers/frontend';
import { FRAMEWORK_PACKS } from './frameworks';

describe('resolveMigrationCatalog', () => {
  it('resolves a known backend pair (express -> fastify)', () => {
    const result = resolveMigrationCatalog('express', 'fastify');
    if (!result) { assert.fail('express -> fastify should be in the catalog'); return; }
    assert.equal(result.source, 'express');
    assert.equal(result.target, 'fastify');
    assert.equal(result.layer, 'backend');
    assert.ok(result.ruleSections.length > 0, 'must produce rule sections');
    assert.ok(result.architecturalRules.length > 0, 'must produce flattened rules');
  });

  it('resolves a known frontend pair (react -> vue)', () => {
    const result = resolveMigrationCatalog('react', 'vue');
    if (!result) { assert.fail('react -> vue should be in the catalog'); return; }
    assert.equal(result.source, 'react');
    assert.equal(result.target, 'vue');
    assert.equal(result.layer, 'frontend');
    assert.ok(result.ruleSections.length > 0);
  });

  it('resolves hono backend pairs', () => {
    const result = resolveMigrationCatalog('express', 'hono');
    if (!result) { assert.fail('express -> hono should be in the catalog'); return; }
    assert.equal(result.layer, 'backend');

    const reverse = resolveMigrationCatalog('hono', 'express');
    assert.ok(reverse, 'hono -> express should be in the catalog');
  });

  it('returns undefined for unsupported pairs', () => {
    assert.equal(resolveMigrationCatalog('express', 'react'), undefined);
    assert.equal(resolveMigrationCatalog('django', 'fastapi'), undefined);
    assert.equal(resolveMigrationCatalog('', ''), undefined);
  });

  it('is case-insensitive', () => {
    const lower = resolveMigrationCatalog('express', 'fastify');
    const upper = resolveMigrationCatalog('Express', 'Fastify');
    const mixed = resolveMigrationCatalog('EXPRESS', 'fastify');
    if (!lower) { assert.fail('lower case lookup failed'); return; }
    if (!upper) { assert.fail('upper case lookup failed'); return; }
    if (!mixed) { assert.fail('mixed case lookup failed'); return; }
    assert.equal(lower.source, upper.source);
    assert.equal(lower.target, mixed.target);
  });

  it('includes all rule layers in the resolved output', () => {
    const result = resolveMigrationCatalog('express', 'fastify');
    if (!result) { assert.fail('express -> fastify should resolve'); return; }

    const scopes = result.ruleSections.map((s) => s.scope);
    assert.ok(scopes.includes('all'), 'must include "all" layer');
    assert.ok(scopes.includes('backend'), 'must include "backend" layer');
    assert.ok(scopes.includes('pair'), 'must include "pair" layer');
  });

  it('includes framework sections for source and target', () => {
    const result = resolveMigrationCatalog('react', 'vue');
    if (!result) { assert.fail('react -> vue should resolve'); return; }

    const frameworkSections = result.ruleSections.filter((s) => s.scope === 'framework');
    assert.ok(frameworkSections.length >= 2, 'must include framework sections for both source and target');

    const labels = frameworkSections.map((s) => s.label);
    assert.ok(labels.some((l) => l.includes('react') && l.includes('source')));
    assert.ok(labels.some((l) => l.includes('vue') && l.includes('target')));
  });

  it('includes runtime section for frontend targets with a known runtime', () => {
    const result = resolveMigrationCatalog('react', 'angular');
    if (!result) { assert.fail('react -> angular should resolve'); return; }

    const runtimeSections = result.ruleSections.filter((s) => s.scope === 'runtime');
    assert.ok(runtimeSections.length > 0, 'angular target should have Angular CLI runtime rules');
  });

  it('does not include runtime section for backend pairs', () => {
    const result = resolveMigrationCatalog('express', 'fastify');
    if (!result) { assert.fail('express -> fastify should resolve'); return; }

    const runtimeSections = result.ruleSections.filter((s) => s.scope === 'runtime');
    assert.equal(runtimeSections.length, 0, 'backend pairs should not have runtime sections');
  });

  it('does not duplicate framework section when source equals target', () => {
    // This shouldn't happen in practice, but compose.ts has a guard for it
    const sections = composeRuleSections('backend', 'express', 'express', ['test rule']);
    const frameworkSections = sections.filter((s) => s.scope === 'framework');
    assert.ok(frameworkSections.length <= 1, 'same source/target should not duplicate framework section');
  });
});

describe('composeRuleSections', () => {
  it('produces sections in the correct order: all -> layer -> runtime -> framework -> pair', () => {
    const sections = composeRuleSections('frontend', 'react', 'vue', ['pair rule 1']);
    const scopes = sections.map((s) => s.scope);

    const allIdx = scopes.indexOf('all');
    const layerIdx = scopes.indexOf('frontend');
    const pairIdx = scopes.lastIndexOf('pair');

    assert.ok(allIdx >= 0, 'must have all section');
    assert.ok(layerIdx >= 0, 'must have layer section');
    assert.ok(pairIdx >= 0, 'must have pair section');
    assert.ok(allIdx < layerIdx, 'all must come before layer');
    assert.ok(layerIdx < pairIdx, 'layer must come before pair');
  });

  it('deduplicates rules within a section', () => {
    const sections = composeRuleSections('backend', 'express', 'fastify', [
      'duplicate rule',
      'duplicate rule',
      'unique rule',
    ]);
    const pairSection = sections.find((s) => s.scope === 'pair');
    if (!pairSection) { assert.fail('pair section should exist'); return; }
    assert.equal(pairSection.rules.length, 2, 'duplicate rules should be removed');
  });

  it('filters out empty sections', () => {
    const sections = composeRuleSections('backend', 'express', 'fastify', []);
    // pair section with no rules should be filtered out
    const pairSection = sections.find((s) => s.scope === 'pair');
    assert.equal(pairSection, undefined, 'empty pair section should be filtered out');
  });

  it('uses correct kind for each layer', () => {
    const backendSections = composeRuleSections('backend', 'express', 'fastify', ['rule']);
    const backendLayer = backendSections.find((s) => s.scope === 'backend');
    if (!backendLayer) { assert.fail('backend layer section should exist'); return; }
    assert.equal(backendLayer.kind, 'contract');

    const frontendSections = composeRuleSections('frontend', 'react', 'vue', ['rule']);
    const frontendLayer = frontendSections.find((s) => s.scope === 'frontend');
    if (!frontendLayer) { assert.fail('frontend layer section should exist'); return; }
    assert.equal(frontendLayer.kind, 'invariant');
  });

  it('pair section always has kind "mapping"', () => {
    const sections = composeRuleSections('backend', 'express', 'fastify', ['some pair rule']);
    const pair = sections.find((s) => s.scope === 'pair');
    if (!pair) { assert.fail('pair section should exist'); return; }
    assert.equal(pair.kind, 'mapping');
  });
});

describe('formatCatalogRules', () => {
  it('formats sections with flat rules', () => {
    const output = formatCatalogRules([
      { scope: 'all', label: 'Test Section', kind: 'invariant', rules: ['rule one', 'rule two'] },
    ]);
    assert.ok(output.includes('Test Section [invariant]'));
    assert.ok(output.includes('- rule one'));
    assert.ok(output.includes('- rule two'));
  });

  it('formats sections with groups', () => {
    const output = formatCatalogRules([
      {
        scope: 'framework',
        label: 'Framework: react (source)',
        kind: 'contract',
        rules: [],
        groups: [
          { heading: 'Contract', rules: ['contract rule'] },
          { heading: 'Components', rules: ['component rule'] },
        ],
      },
    ]);
    assert.ok(output.includes('Framework: react (source) [contract]'));
    assert.ok(output.includes('Contract:'));
    assert.ok(output.includes('- contract rule'));
    assert.ok(output.includes('Components:'));
    assert.ok(output.includes('- component rule'));
  });

  it('joins multiple sections with double newlines', () => {
    const output = formatCatalogRules([
      { scope: 'all', label: 'Section A', kind: 'invariant', rules: ['a'] },
      { scope: 'pair', label: 'Section B', kind: 'mapping', rules: ['b'] },
    ]);
    assert.ok(output.includes('\n\n'), 'sections should be separated by double newlines');
  });
});

describe('catalog completeness', () => {
  it('every framework pack referenced in catalog pairs actually exists', () => {
    const knownFrameworks = Object.keys(FRAMEWORK_PACKS);
    // All backend catalog sources/targets
    const backendResult = resolveMigrationCatalog('express', 'fastify');
    assert.ok(backendResult);
    assert.ok(knownFrameworks.includes('express'));
    assert.ok(knownFrameworks.includes('fastify'));
    assert.ok(knownFrameworks.includes('nestjs'));
    assert.ok(knownFrameworks.includes('hono'));

    // All frontend catalog sources/targets
    assert.ok(knownFrameworks.includes('react'));
    assert.ok(knownFrameworks.includes('vue'));
    assert.ok(knownFrameworks.includes('angular'));
    assert.ok(knownFrameworks.includes('svelte'));
    assert.ok(knownFrameworks.includes('next'));
  });

  it('all backend pairs are bidirectional', () => {
    const pairs = [
      ['express', 'fastify'],
      ['express', 'nestjs'],
      ['express', 'hono'],
      ['fastify', 'nestjs'],
      ['fastify', 'hono'],
      ['nestjs', 'hono'],
    ];
    for (const [a, b] of pairs) {
      assert.ok(resolveMigrationCatalog(a, b), `${a} -> ${b} should exist`);
      assert.ok(resolveMigrationCatalog(b, a), `${b} -> ${a} should exist`);
    }
  });

  it('all frontend pairs are bidirectional', () => {
    const frameworks = ['react', 'next', 'vue', 'angular', 'svelte'];
    for (const source of frameworks) {
      for (const target of frameworks) {
        if (source === target) continue;
        assert.ok(
          resolveMigrationCatalog(source, target),
          `${source} -> ${target} should exist in the frontend catalog`,
        );
      }
    }
  });

  it('layer rules are non-empty', () => {
    assert.ok(ALL_MIGRATION_RULES.length > 0, 'all-layer rules must not be empty');
    assert.ok(BACKEND_LAYER_RULES.length > 0, 'backend layer rules must not be empty');
    assert.ok(FRONTEND_LAYER_RULES.length > 0, 'frontend layer rules must not be empty');
  });

  it('every framework pack has at least a contract entry', () => {
    for (const [id, pack] of Object.entries(FRAMEWORK_PACKS)) {
      assert.ok(pack.contract.length > 0, `${id} framework pack must have at least one contract rule`);
    }
  });
});
