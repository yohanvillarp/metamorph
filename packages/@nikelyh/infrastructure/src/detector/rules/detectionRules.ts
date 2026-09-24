import type { ArchitectureCategory, RouterVariant } from '@nikelyh/domain';

export interface FrameworkRule {
  framework: string;
  category: ArchitectureCategory;
  packageKeys: string[];
  devPackageKeys?: string[];
  configPrefixes: string[];
  routerVariants?: RouterVariant[];
  subsumes?: string[]; // frameworks or packages this framework dominates
  suggestedTargets: string[];
}

export const FRAMEWORK_DETECTION_RULES: FrameworkRule[] = [
  {
    framework: 'next',
    category: 'frontend-meta',
    packageKeys: ['next'],
    configPrefixes: ['next.config'],
    routerVariants: ['next-app-router', 'next-pages-router'],
    subsumes: ['react', 'react-dom'],
    suggestedTargets: ['react', 'vue', 'angular', 'svelte'],
  },
  {
    framework: 'react',
    category: 'frontend-spa',
    packageKeys: ['react'],
    configPrefixes: ['vite.config', 'webpack.config'],
    routerVariants: ['react-router'],
    suggestedTargets: ['next', 'vue', 'angular', 'svelte'],
  },
  {
    framework: 'vue',
    category: 'frontend-spa',
    packageKeys: ['vue'],
    devPackageKeys: ['@vitejs/plugin-vue'],
    configPrefixes: ['vue.config', 'vite.config'],
    routerVariants: ['vue-router'],
    suggestedTargets: ['react', 'next', 'angular', 'svelte'],
  },
  {
    framework: 'svelte',
    category: 'frontend-spa',
    packageKeys: ['svelte', '@sveltejs/kit'],
    devPackageKeys: ['@sveltejs/vite-plugin-svelte'],
    configPrefixes: ['svelte.config', 'vite.config'],
    routerVariants: ['sveltekit'],
    suggestedTargets: ['react', 'next', 'vue', 'angular'],
  },
  {
    framework: 'angular',
    category: 'frontend-spa',
    packageKeys: ['@angular/core'],
    devPackageKeys: ['@angular/cli', '@angular-devkit/build-angular'],
    configPrefixes: ['angular.json'],
    routerVariants: ['angular-router'],
    suggestedTargets: ['react', 'next', 'vue', 'svelte'],
  },
  {
    framework: 'nestjs',
    category: 'backend-api',
    packageKeys: ['@nestjs/core', '@nestjs/common'],
    configPrefixes: ['nest-cli.json'],
    subsumes: ['express', 'fastify', '@nestjs/platform-express', '@nestjs/platform-fastify'],
    suggestedTargets: ['express', 'fastify'],
  },
  {
    framework: 'express',
    category: 'backend-api',
    packageKeys: ['express'],
    configPrefixes: [],
    suggestedTargets: ['fastify', 'nestjs'],
  },
  {
    framework: 'fastify',
    category: 'backend-api',
    packageKeys: ['fastify'],
    configPrefixes: [],
    suggestedTargets: ['express', 'nestjs'],
  },
];
