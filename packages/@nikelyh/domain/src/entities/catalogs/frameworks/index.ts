/**
 * Per-framework packs. Applied when that id is source, then again when it is target.
 * Component model lives here. Toolchain (Vite vs Next vs ng) lives in layers/runtimes.ts.
 */
export type { FrameworkPack } from './types';
import type { FrameworkPack } from './types';

import { reactPack } from './react';
import { nextPack } from './next';
import { vuePack } from './vue';
import { angularPack } from './angular';
import { sveltePack } from './svelte';
import { expressPack } from './express';
import { fastifyPack } from './fastify';
import { nestjsPack } from './nestjs';
import { honoPack } from './hono';

export const FRAMEWORK_PACKS: Record<string, FrameworkPack> = {
  react: reactPack,
  next: nextPack,
  vue: vuePack,
  angular: angularPack,
  svelte: sveltePack,
  express: expressPack,
  fastify: fastifyPack,
  nestjs: nestjsPack,
  hono: honoPack,
};

export function rulesForFramework(id: string): string[] {
  const pack = FRAMEWORK_PACKS[id.toLowerCase()];
  if (!pack) return [];
  return [...pack.contract, ...pack.components, ...pack.routing, ...pack.styling, ...pack.antiPatterns];
}

export function packForFramework(id: string): FrameworkPack | undefined {
  return FRAMEWORK_PACKS[id.toLowerCase()];
}

/** @deprecated Use FRAMEWORK_PACKS. Kept so older imports still typecheck. */
export const FRAMEWORK_RULES: Record<string, string[]> = Object.fromEntries(
  Object.entries(FRAMEWORK_PACKS).map(([id]) => [id, rulesForFramework(id)]),
);
