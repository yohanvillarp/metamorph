import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { classifyMissingFile } from './classifyMissingFile';

describe('classifyMissingFile', () => {
  const shadowRoot = path.resolve('/mock/shadow/run-1');

  test('rejects missing vite.config.ts if no next.config.* exists', () => {
    const filePath = path.join(shadowRoot, 'vite.config.ts');
    const result = classifyMissingFile({
      filePath,
      source: 'react',
      target: 'next',
      shadowRoot,
      fileExists: () => false,
    });

    assert.equal(result.verdict, 'rejected');
    assert.match(result.errors![0], /no Next.js configuration/);
  });

  test('approves missing vite.config.ts if next.config.mjs exists', () => {
    const filePath = path.join(shadowRoot, 'vite.config.ts');
    const nextConfig = path.join(shadowRoot, 'next.config.mjs');
    const result = classifyMissingFile({
      filePath,
      source: 'react',
      target: 'next',
      shadowRoot,
      fileExists: (p) => path.resolve(p) === path.resolve(nextConfig),
    });

    assert.equal(result.verdict, 'approved');
  });

  test('rejects missing index.html if no Next.js layout exists', () => {
    const filePath = path.join(shadowRoot, 'index.html');
    const result = classifyMissingFile({
      filePath,
      source: 'react',
      target: 'next',
      shadowRoot,
      fileExists: () => false,
    });

    assert.equal(result.verdict, 'rejected');
    assert.match(result.errors![0], /no Next.js root layout/);
  });

  test('approves missing index.html if src/app/layout.tsx exists', () => {
    const filePath = path.join(shadowRoot, 'index.html');
    const layout = path.join(shadowRoot, 'src', 'app', 'layout.tsx');
    const result = classifyMissingFile({
      filePath,
      source: 'react',
      target: 'next',
      shadowRoot,
      fileExists: (p) => path.resolve(p) === path.resolve(layout),
    });

    assert.equal(result.verdict, 'approved');
  });

  test('rejects missing src/App.tsx if no App Router routes exist', () => {
    const filePath = path.join(shadowRoot, 'src', 'App.tsx');
    const result = classifyMissingFile({
      filePath,
      source: 'react',
      target: 'next',
      shadowRoot,
      fileExists: () => false,
    });

    assert.equal(result.verdict, 'rejected');
    assert.match(result.errors![0], /SPA root was deleted before/);
  });

  test('rejects missing src/pages/dashboard/ui/DashboardPage.tsx if not moved to views', () => {
    const filePath = path.join(shadowRoot, 'src', 'pages', 'dashboard', 'ui', 'DashboardPage.tsx');
    const result = classifyMissingFile({
      filePath,
      source: 'react',
      target: 'next',
      shadowRoot,
      fileExists: () => false,
    });

    assert.equal(result.verdict, 'rejected');
    assert.match(result.errors![0], /Next.js reserves src\/pages/);
  });

  test('approves missing src/pages/dashboard/ui/DashboardPage.tsx if moved to src/views', () => {
    const filePath = path.join(shadowRoot, 'src', 'pages', 'dashboard', 'ui', 'DashboardPage.tsx');
    const viewsTarget = path.join(shadowRoot, 'src', 'views', 'dashboard', 'ui', 'DashboardPage.tsx');
    const result = classifyMissingFile({
      filePath,
      source: 'react',
      target: 'next',
      shadowRoot,
      fileExists: (p) => path.resolve(p) === path.resolve(viewsTarget),
    });

    assert.equal(result.verdict, 'approved');
  });

  test('rejects arbitrary missing component file (never auto-approves arbitrary deletes)', () => {
    const filePath = path.join(shadowRoot, 'src', 'components', 'Button.tsx');
    const result = classifyMissingFile({
      filePath,
      source: 'react',
      target: 'next',
      shadowRoot,
      fileExists: () => false,
    });

    assert.equal(result.verdict, 'rejected');
    assert.match(result.errors![0], /no demonstrable replacement/);
  });
});
