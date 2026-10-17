import type { CatalogLayer, FrameworkId } from './types';

export interface FrameworkMetadata {
  label: string;
  group: CatalogLayer;
}

export const FRAMEWORK_METADATA: Record<FrameworkId, FrameworkMetadata> = {
  express: { label: 'Express', group: 'backend' },
  fastify: { label: 'Fastify', group: 'backend' },
  nestjs: { label: 'NestJS', group: 'backend' },
  hono: { label: 'Hono', group: 'backend' },
  next: { label: 'Next.js', group: 'frontend' },
  react: { label: 'React', group: 'frontend' },
  vue: { label: 'Vue', group: 'frontend' },
  angular: { label: 'Angular', group: 'frontend' },
  svelte: { label: 'Svelte', group: 'frontend' },
};
