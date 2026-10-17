import type { ArchitectureCategory, FrameworkId, RouterVariant } from '@nikelyh/domain';

export interface FrameworkRule {
  framework: FrameworkId;
  category: ArchitectureCategory;
  packageKeys: string[];
  devPackageKeys?: string[];
  configPrefixes: string[];
  routerVariants?: RouterVariant[];
  subsumes?: string[]; // frameworks or packages this framework dominates
  suggestedTargets?: FrameworkId[];
}

export const FRAMEWORK_DETECTION_RULES: FrameworkRule[] = [
  {
    framework: 'next',
    category: 'frontend-meta',
    packageKeys: ['next'],
    configPrefixes: ['next.config'],
    routerVariants: ['next-app-router', 'next-pages-router'],
    subsumes: ['react', 'react-dom'],
  },
  {
    framework: 'react',
    category: 'frontend-spa',
    packageKeys: ['react'],
    configPrefixes: ['vite.config', 'webpack.config'],
    routerVariants: ['react-router'],
  },
  {
    framework: 'vue',
    category: 'frontend-spa',
    packageKeys: ['vue'],
    devPackageKeys: ['@vitejs/plugin-vue'],
    configPrefixes: ['vue.config', 'vite.config'],
    routerVariants: ['vue-router'],
  },
  {
    framework: 'svelte',
    category: 'frontend-spa',
    packageKeys: ['svelte', '@sveltejs/kit'],
    devPackageKeys: ['@sveltejs/vite-plugin-svelte'],
    configPrefixes: ['svelte.config', 'vite.config'],
    routerVariants: ['sveltekit'],
  },
  {
    framework: 'angular',
    category: 'frontend-spa',
    packageKeys: ['@angular/core'],
    devPackageKeys: ['@angular/cli', '@angular-devkit/build-angular'],
    configPrefixes: ['angular.json'],
    routerVariants: ['angular-router'],
  },
  {
    framework: 'nestjs',
    category: 'backend-api',
    packageKeys: ['@nestjs/core', '@nestjs/common'],
    configPrefixes: ['nest-cli.json'],
    subsumes: ['express', 'fastify', '@nestjs/platform-express', '@nestjs/platform-fastify'],
  },
  {
    framework: 'express',
    category: 'backend-api',
    packageKeys: ['express'],
    devPackageKeys: ['@types/express'],
    configPrefixes: [],
  },
  {
    framework: 'fastify',
    category: 'backend-api',
    packageKeys: ['fastify'],
    devPackageKeys: ['fastify-plugin'],
    configPrefixes: [],
  },
  {
    framework: 'hono',
    category: 'backend-api',
    packageKeys: ['hono'],
    devPackageKeys: ['@hono/node-server'],
    configPrefixes: [],
  },
];
