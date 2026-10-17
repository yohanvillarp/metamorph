import type { SupportedFrameworkItem } from '@/shared/api/types';

export const FRAMEWORKS: SupportedFrameworkItem[] = [
  { value: 'express',   label: 'Express',    group: 'backend',  icon: '/icons/expressjs.svg' },
  { value: 'fastify',   label: 'Fastify',    group: 'backend',  icon: '/icons/fastify.svg' },
  { value: 'nestjs',    label: 'NestJS',     group: 'backend',  icon: '/icons/nestjs.svg' },
  { value: 'hono',      label: 'Hono',       group: 'backend',  icon: '/icons/hono.svg' },
  { value: 'next',      label: 'Next.js',    group: 'frontend', icon: '/icons/nextjs.svg' },
  { value: 'react',     label: 'React',      group: 'frontend', icon: '/icons/react.svg' },
  { value: 'vue',       label: 'Vue',        group: 'frontend', icon: '/icons/vue.svg' },
  { value: 'angular',   label: 'Angular',    group: 'frontend', icon: '/icons/angular.svg' },
  { value: 'svelte',    label: 'Svelte',     group: 'frontend', icon: '/icons/svelte.svg' },
];

const FRAMEWORK_ICON_MAP: Record<string, string> = {
  express: '/icons/expressjs.svg',
  next: '/icons/nextjs.svg',
};

export function resolveFrameworkIcon(framework: string): string {
  if (!framework) return '';
  const key = framework.toLowerCase();
  return FRAMEWORK_ICON_MAP[key] || `/icons/${key}.svg`;
}

export { useSupportedCatalogs } from './model/useSupportedCatalogs';

export type Tab = 'overview' | 'swarm' | 'queue' | 'events' | 'diff';

export interface WorkspacePackage {
  name: string;
  relativePath: string;
  absolutePath: string;
  detectedFramework?: string;
}

export interface MonorepoContext {
  isMonorepo: boolean;
  tool?: 'turbo' | 'pnpm' | 'npm' | 'yarn' | 'nx' | 'lerna';
  packages: WorkspacePackage[];
  rootPath: string;
}

export interface ProjectProfile {
  framework: string;
  category: string;
  variant: string;
  bundler: string;
  packageManager: string;
  language: 'typescript' | 'javascript';
  hasTsConfig: boolean;
  pathAliases: Record<string, string[]>;
  monorepo?: MonorepoContext;
  confidence: number;
  evidence: string[];
  subsumedDependencies: string[];
  suggestedTargets: string[];
}

export interface DetectedTech {
  framework: string;
  confidence: number;
  evidence: string[];
  profile?: ProjectProfile;
}

export type {
  TaskItem,
  MigrationEventItem,
  MigrationPlan,
  AgentRoleCost,
  ModelCostBreakdown,
  MigrationCostSummary,
  StartMigrationResponse,
  ApplyMigrationResponse,
  SupportedFrameworkItem,
  SupportedCatalogsResponse,
} from '@/shared/api/types';
