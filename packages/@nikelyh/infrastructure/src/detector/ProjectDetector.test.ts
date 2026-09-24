import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectProject, detectTechnologies } from './ProjectDetector';
import { resolveProjectRoot, detectMonorepo } from './WorkspaceResolver';

function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `metamorph-test-${prefix}-`));
}

describe('Project Intelligence Engine (ProjectDetector)', () => {
  it('detects Next.js App Router (Zero-Config) and subsumes React cleanly', () => {
    const dir = createTempDir('next-app');
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'my-next-app',
          dependencies: {
            next: '^14.2.0',
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
          scripts: {
            dev: 'next dev',
            build: 'next build',
          },
        })
      );
      mkdirSync(join(dir, 'src', 'app'), { recursive: true });
      writeFileSync(join(dir, 'src', 'app', 'layout.tsx'), 'export default function RootLayout() {}');
      writeFileSync(join(dir, 'src', 'app', 'page.tsx'), 'export default function Page() {}');

      const profiles = inspectProject(dir);
      assert.ok(profiles.length > 0, 'Must detect at least one framework');

      const primary = profiles[0];
      assert.equal(primary.framework, 'next');
      assert.equal(primary.variant, 'next-app-router');
      assert.equal(primary.category, 'frontend-meta');
      assert.ok(primary.confidence >= 80, `Expected confidence >= 80, got ${primary.confidence}`);
      assert.ok(primary.subsumedDependencies.includes('react'), 'Should list react in subsumed dependencies');

      // Crucial: React must NOT be presented as a separate competing primary candidate
      const competingReact = profiles.find(p => p.framework === 'react');
      assert.equal(competingReact, undefined, 'React must be suppressed by Next.js subsumption');

      // Test backwards-compatible detectTechnologies
      const legacyDetected = detectTechnologies(dir);
      assert.equal(legacyDetected[0].framework, 'next');
      assert.ok(legacyDetected[0].profile !== undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects Next.js Pages Router when pages directory is used', () => {
    const dir = createTempDir('next-pages');
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'pages-next-app',
          dependencies: {
            next: '^13.5.0',
            react: '^18.2.0',
          },
        })
      );
      writeFileSync(join(dir, 'next.config.mjs'), 'export default {};');
      mkdirSync(join(dir, 'pages'), { recursive: true });
      writeFileSync(join(dir, 'pages', '_app.tsx'), 'export default function App() {}');
      writeFileSync(join(dir, 'pages', 'index.tsx'), 'export default function Home() {}');

      const profiles = inspectProject(dir);
      assert.equal(profiles[0].framework, 'next');
      assert.equal(profiles[0].variant, 'next-pages-router');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects NestJS and subsumes underlying Express HTTP driver', () => {
    const dir = createTempDir('nest-app');
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'nest-api',
          dependencies: {
            '@nestjs/core': '^10.0.0',
            '@nestjs/common': '^10.0.0',
            '@nestjs/platform-express': '^10.0.0',
            express: '^4.19.2',
          },
        })
      );
      writeFileSync(join(dir, 'nest-cli.json'), '{}');
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(join(dir, 'src', 'app.controller.ts'), '@Controller() export class AppController {}');

      const profiles = inspectProject(dir);
      assert.ok(profiles.length > 0);
      const primary = profiles[0];
      assert.equal(primary.framework, 'nestjs');
      assert.equal(primary.category, 'backend-api');
      assert.ok(primary.subsumedDependencies.includes('express'));

      const competingExpress = profiles.find(p => p.framework === 'express');
      assert.equal(competingExpress, undefined, 'Express must be suppressed when NestJS is present');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects modern Vue 3 with Vite and .vue SFC presence', () => {
    const dir = createTempDir('vue3-vite');
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'vue-app',
          dependencies: {
            vue: '^3.4.0',
          },
          devDependencies: {
            vite: '^5.2.0',
            '@vitejs/plugin-vue': '^5.0.0',
          },
        })
      );
      writeFileSync(join(dir, 'vite.config.ts'), 'export default {};');
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(join(dir, 'src', 'App.vue'), '<template><div>Hello</div></template>');

      const profiles = inspectProject(dir);
      assert.equal(profiles[0].framework, 'vue');
      assert.equal(profiles[0].bundler, 'vite');
      assert.ok(profiles[0].confidence >= 75);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects SvelteKit project variant', () => {
    const dir = createTempDir('sveltekit');
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'my-svelte-app',
          devDependencies: {
            '@sveltejs/kit': '^2.0.0',
            svelte: '^4.0.0',
          },
        })
      );
      writeFileSync(join(dir, 'svelte.config.js'), 'export default {};');
      mkdirSync(join(dir, 'src', 'routes'), { recursive: true });
      writeFileSync(join(dir, 'src', 'routes', '+page.svelte'), '<h1>SvelteKit</h1>');

      const profiles = inspectProject(dir);
      assert.equal(profiles[0].framework, 'svelte');
      assert.equal(profiles[0].variant, 'sveltekit');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects monorepo structure and extracts member packages', () => {
    const dir = createTempDir('monorepo');
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'root-monorepo',
          private: true,
          workspaces: ['apps/*'],
        })
      );
      writeFileSync(join(dir, 'turbo.json'), '{}');

      mkdirSync(join(dir, 'apps', 'web-client'), { recursive: true });
      writeFileSync(
        join(dir, 'apps', 'web-client', 'package.json'),
        JSON.stringify({ name: '@acme/web', dependencies: { react: '^18.2.0' } })
      );

      mkdirSync(join(dir, 'apps', 'api-server'), { recursive: true });
      writeFileSync(
        join(dir, 'apps', 'api-server', 'package.json'),
        JSON.stringify({ name: '@acme/api', dependencies: { fastify: '^4.0.0' } })
      );

      const monorepo = detectMonorepo(dir);
      assert.equal(monorepo.isMonorepo, true);
      assert.equal(monorepo.tool, 'turbo');
      assert.equal(monorepo.packages.length, 2);
      assert.ok(monorepo.packages.some(p => p.name === '@acme/web'));
      assert.ok(monorepo.packages.some(p => p.name === '@acme/api'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('performs upward traversal to locate the real project root from a nested subfolder', () => {
    const dir = createTempDir('nested-root');
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'nested-app', dependencies: { express: '^4.19.0' } })
      );
      const deepPath = join(dir, 'src', 'controllers', 'admin');
      mkdirSync(deepPath, { recursive: true });

      const resolved = resolveProjectRoot(deepPath);
      assert.equal(resolved, dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
