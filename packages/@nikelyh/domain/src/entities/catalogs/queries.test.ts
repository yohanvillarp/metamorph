import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSupportedMigrations,
  getSupportedFrameworks,
  getTargetsForFramework,
} from './queries';
import { SUPPORTED_FRAMEWORKS, FrameworkId } from './types';
import { FRAMEWORK_METADATA } from './metadata';

describe('Domain Catalog Queries (SSOT)', () => {
  it('getSupportedMigrations returns complete mappings for all supported frameworks', () => {
    const migrations = getSupportedMigrations();

    for (const framework of SUPPORTED_FRAMEWORKS) {
      assert.ok(
        migrations[framework] && migrations[framework].length > 0,
        `Expected ${framework} to have supported targets in getSupportedMigrations()`
      );
    }

    // Verify backend relationships
    assert.deepEqual(migrations['hono'].sort(), ['express', 'fastify', 'nestjs'].sort());
    assert.ok(migrations['express'].includes('hono'));
    assert.ok(migrations['fastify'].includes('hono'));
    assert.ok(migrations['nestjs'].includes('hono'));

    // Verify frontend relationships
    assert.deepEqual(migrations['react'].sort(), ['angular', 'next', 'svelte', 'vue'].sort());
    assert.ok(migrations['next'].includes('react'));
  });

  it('getSupportedFrameworks returns metadata and groups for all frameworks', () => {
    const frameworks = getSupportedFrameworks();
    const values = frameworks.map((f) => f.value);

    for (const framework of SUPPORTED_FRAMEWORKS) {
      assert.ok(values.includes(framework), `Expected ${framework} in getSupportedFrameworks()`);
    }

    const next = frameworks.find((f) => f.value === 'next');
    assert.equal(next?.label, 'Next.js');
    assert.equal(next?.group, 'frontend');

    const nest = frameworks.find((f) => f.value === 'nestjs');
    assert.equal(nest?.label, 'NestJS');
    assert.equal(nest?.group, 'backend');
  });

  it('getTargetsForFramework returns exact targets for a given framework', () => {
    const honoTargets = getTargetsForFramework('hono');
    assert.deepEqual(honoTargets.sort(), ['express', 'fastify', 'nestjs'].sort());

    const unknownTargets = getTargetsForFramework('django');
    assert.deepEqual(unknownTargets, []);
  });

  it('FRAMEWORK_METADATA covers every item in SUPPORTED_FRAMEWORKS', () => {
    for (const framework of SUPPORTED_FRAMEWORKS) {
      const meta = FRAMEWORK_METADATA[framework];
      assert.ok(meta, `Missing metadata for ${framework}`);
      assert.ok(meta.label.length > 0, `Empty label for ${framework}`);
      assert.ok(meta.group === 'backend' || meta.group === 'frontend', `Invalid group for ${framework}`);
    }
  });
});
