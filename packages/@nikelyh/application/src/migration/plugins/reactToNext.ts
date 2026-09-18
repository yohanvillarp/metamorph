import * as path from 'path';
import type { MigrationPlugin } from '../types';
import {
  analyzeReactToNextStructure,
  listAppRouterFiles,
  nextMigrationFileHint,
} from '../../utils/NextMigrationHints';

export const reactToNextPlugin: MigrationPlugin = {
  id: 'react-to-next',
  source: 'react',
  target: 'next',
  layer: 'frontend',
  fileHint(filePath, ctx) {
    return nextMigrationFileHint(filePath, ctx.target);
  },
  verifyShadow(shadowRoot) {
    return analyzeReactToNextStructure(shadowRoot);
  },
  repairTargets(shadowRoot) {
    return [
      path.join(shadowRoot, 'package.json'),
      path.join(shadowRoot, 'next.config.ts'),
      path.join(shadowRoot, 'next.config.js'),
      path.join(shadowRoot, 'next.config.mjs'),
      path.join(shadowRoot, 'src', 'app', 'page.tsx'),
      path.join(shadowRoot, 'src', 'app', 'layout.tsx'),
      path.join(shadowRoot, 'app', 'page.tsx'),
      path.join(shadowRoot, 'app', 'layout.tsx'),
      ...listAppRouterFiles(shadowRoot),
    ];
  },
};
