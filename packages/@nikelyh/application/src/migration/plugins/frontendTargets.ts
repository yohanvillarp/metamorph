import * as path from 'path';
import type { MigrationPlugin } from '../types';
import {
  analyzeAngularTarget,
  analyzeSvelteTarget,
  analyzeVueTarget,
  angularFileHint,
  svelteFileHint,
  vueFileHint,
} from '../../utils/FrontendRuntimeHints';

export const vueTargetPlugin: MigrationPlugin = {
  id: 'target-vue',
  target: 'vue',
  layer: 'frontend',
  fileHint(filePath, ctx) {
    return vueFileHint(filePath, ctx.target);
  },
  verifyShadow(shadowRoot) {
    return analyzeVueTarget(shadowRoot);
  },
  repairTargets(shadowRoot) {
    return [
      path.join(shadowRoot, 'package.json'),
      path.join(shadowRoot, 'vite.config.ts'),
      path.join(shadowRoot, 'index.html'),
      path.join(shadowRoot, 'src', 'main.ts'),
      path.join(shadowRoot, 'src', 'App.vue'),
    ];
  },
};

export const svelteTargetPlugin: MigrationPlugin = {
  id: 'target-svelte',
  target: 'svelte',
  layer: 'frontend',
  fileHint(filePath, ctx) {
    return svelteFileHint(filePath, ctx.target);
  },
  verifyShadow(shadowRoot) {
    return analyzeSvelteTarget(shadowRoot);
  },
  repairTargets(shadowRoot) {
    return [
      path.join(shadowRoot, 'package.json'),
      path.join(shadowRoot, 'vite.config.ts'),
      path.join(shadowRoot, 'svelte.config.js'),
      path.join(shadowRoot, 'index.html'),
      path.join(shadowRoot, 'src', 'main.ts'),
      path.join(shadowRoot, 'src', 'App.svelte'),
    ];
  },
};

export const angularTargetPlugin: MigrationPlugin = {
  id: 'target-angular',
  target: 'angular',
  layer: 'frontend',
  fileHint(filePath, ctx) {
    return angularFileHint(filePath, ctx.target);
  },
  verifyShadow(shadowRoot) {
    return analyzeAngularTarget(shadowRoot);
  },
  repairTargets(shadowRoot) {
    return [
      path.join(shadowRoot, 'package.json'),
      path.join(shadowRoot, 'angular.json'),
      path.join(shadowRoot, 'src', 'main.ts'),
      path.join(shadowRoot, 'src', 'index.html'),
      path.join(shadowRoot, 'src', 'styles.css'),
      path.join(shadowRoot, 'src', 'app', 'app.ts'),
      path.join(shadowRoot, 'src', 'app', 'app.routes.ts'),
      path.join(shadowRoot, 'src', 'app', 'app.config.ts'),
    ];
  },
};
