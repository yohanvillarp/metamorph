export const FRAMEWORKS = [
  { value: 'express',   label: 'Express',    group: 'backend',  icon: '/icons/expressjs.svg' },
  { value: 'fastify',   label: 'Fastify',    group: 'backend',  icon: '/icons/fastify.svg' },
  { value: 'nestjs',    label: 'NestJS',     group: 'backend',  icon: '/icons/nestjs.svg' },
  { value: 'koa',       label: 'Koa',        group: 'backend',  icon: '/icons/koa.svg' },
  { value: 'hapi',      label: 'Hapi',       group: 'backend',  icon: '/icons/hapi.svg' },
  { value: 'next',      label: 'Next.js',    group: 'frontend', icon: '/icons/nextjs.svg' },
  { value: 'react',     label: 'React',      group: 'frontend', icon: '/icons/react.svg' },
  { value: 'vue',       label: 'Vue',        group: 'frontend', icon: '/icons/vue.svg' },
  { value: 'angular',   label: 'Angular',    group: 'frontend', icon: '/icons/angular.svg' },
  { value: 'svelte',    label: 'Svelte',     group: 'frontend', icon: '/icons/svelte.svg' },
];

export type Tab = 'overview' | 'swarm' | 'queue' | 'events';

export interface DetectedTech {
  framework: string;
  confidence: number;
  evidence: string[];
}

export interface MigrationPlan {
  id: string;
  sourceFramework: string;
  targetFramework: string;
  targetPath: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalFiles: number;
  migratedFiles: number;
  createdAt: string;
  tasks: any[];
}
