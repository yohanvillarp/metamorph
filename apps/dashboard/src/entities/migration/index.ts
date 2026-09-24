export const FRAMEWORKS = [
  { value: 'express',   label: 'Express',    group: 'backend',  icon: '/icons/expressjs.svg' },
  { value: 'fastify',   label: 'Fastify',    group: 'backend',  icon: '/icons/fastify.svg' },
  { value: 'nestjs',    label: 'NestJS',     group: 'backend',  icon: '/icons/nestjs.svg' },
  // { value: 'koa',       label: 'Koa',        group: 'backend',  icon: '/icons/koa.svg' },
  // { value: 'hapi',      label: 'Hapi',       group: 'backend',  icon: '/icons/hapi.svg' },
  { value: 'next',      label: 'Next.js',    group: 'frontend', icon: '/icons/nextjs.svg' },
  { value: 'react',     label: 'React',      group: 'frontend', icon: '/icons/react.svg' },
  { value: 'vue',       label: 'Vue',        group: 'frontend', icon: '/icons/vue.svg' },
  { value: 'angular',   label: 'Angular',    group: 'frontend', icon: '/icons/angular.svg' },
  { value: 'svelte',    label: 'Svelte',     group: 'frontend', icon: '/icons/svelte.svg' },
];

export type Tab = 'overview' | 'swarm' | 'queue' | 'events';

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

export interface MigrationPlan {
  id: string;
  runId: string;
  sourceFramework: string;
  targetFramework: string;
  targetPath: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  phase?: 'files' | 'integration' | 'completed' | 'failed';
  outcome?: 'success' | 'failed';
  appliedAt?: string;
  appliedBranch?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalFiles: number;
  migratedFiles: number;
  createdAt: string;
  tasks: any[];
}
