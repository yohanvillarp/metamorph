import { Request, Response } from 'express';
import { resolve } from 'node:path';
import type { ArchetypeInfo } from '../types/index.js';

const ARCHETYPES: ArchetypeInfo[] = [
  {
    id: 'react-spa-minimal',
    name: 'React SPA Minimal',
    category: 'frontend',
    path: resolve(process.cwd(), 'lab/archetypes/frontend/react-spa-minimal'),
    description: 'Minimal baseline React SPA with single view component and Vite bundler.',
    sourceFramework: 'react',
    recommendedTargets: ['next', 'vue', 'svelte', 'angular'],
  },
  {
    id: 'react-spa-full',
    name: 'React SPA Full',
    category: 'frontend',
    path: resolve(process.cwd(), 'lab/archetypes/frontend/react-spa-full'),
    description: 'Comprehensive React SPA with multi-route navigation, layout, and client state.',
    sourceFramework: 'react',
    recommendedTargets: ['next', 'vue', 'svelte'],
  },
  {
    id: 'express-minimal',
    name: 'Express Minimal',
    category: 'backend',
    path: resolve(process.cwd(), 'lab/archetypes/backend/express-minimal'),
    description: 'Single-file Express server with standard HTTP endpoints.',
    sourceFramework: 'express',
    recommendedTargets: ['hono', 'fastify', 'nestjs'],
  },
  {
    id: 'express-layered-api',
    name: 'Express Layered API',
    category: 'backend',
    path: resolve(process.cwd(), 'lab/archetypes/backend/express-layered-api'),
    description: 'Layered architecture Express API with dedicated routes, controllers, and services.',
    sourceFramework: 'express',
    recommendedTargets: ['hono', 'fastify', 'nestjs'],
  },
  {
    id: 'fastify-minimal',
    name: 'Fastify Minimal',
    category: 'backend',
    path: resolve(process.cwd(), 'lab/archetypes/backend/fastify-minimal'),
    description: 'Single-file Fastify server with typed routes and built-in logger.',
    sourceFramework: 'fastify',
    recommendedTargets: ['express', 'hono', 'nestjs'],
  },
  {
    id: 'hono-minimal',
    name: 'Hono Minimal',
    category: 'backend',
    path: resolve(process.cwd(), 'lab/archetypes/backend/hono-minimal'),
    description: 'Lightweight Hono server with node-server adapter and JSON endpoints.',
    sourceFramework: 'hono',
    recommendedTargets: ['express', 'fastify', 'nestjs'],
  },
  {
    id: 'nestjs-minimal',
    name: 'NestJS Minimal',
    category: 'backend',
    path: resolve(process.cwd(), 'lab/archetypes/backend/nestjs-minimal'),
    description: 'NestJS application with module, controller, and service using decorator-based DI.',
    sourceFramework: 'nestjs',
    recommendedTargets: ['express', 'fastify', 'hono'],
  },
  {
    id: 'vue-spa-minimal',
    name: 'Vue SPA Minimal',
    category: 'frontend',
    path: resolve(process.cwd(), 'lab/archetypes/frontend/vue-spa-minimal'),
    description: 'Minimal Vue 3 SPA with vue-router and Vite bundler.',
    sourceFramework: 'vue',
    recommendedTargets: ['react', 'next', 'svelte', 'angular'],
  },
  {
    id: 'svelte-spa-minimal',
    name: 'Svelte SPA Minimal',
    category: 'frontend',
    path: resolve(process.cwd(), 'lab/archetypes/frontend/svelte-spa-minimal'),
    description: 'Minimal Svelte 5 SPA with runes and Vite bundler.',
    sourceFramework: 'svelte',
    recommendedTargets: ['react', 'next', 'vue', 'angular'],
  },
  {
    id: 'angular-spa-minimal',
    name: 'Angular SPA Minimal',
    category: 'frontend',
    path: resolve(process.cwd(), 'lab/archetypes/frontend/angular-spa-minimal'),
    description: 'Minimal Angular standalone SPA with router and component-based architecture.',
    sourceFramework: 'angular',
    recommendedTargets: ['react', 'next', 'vue', 'svelte'],
  },
];

export class ArchetypesController {
  public listArchetypes(_req: Request, res: Response): void {
    res.json({ archetypes: ARCHETYPES });
  }

  public getArchetypeById(req: Request, res: Response): void {
    const id = String(req.params.id || '');
    const archetype = ARCHETYPES.find((a) => a.id === id);
    if (!archetype) {
      res.status(404).json({ error: 'Archetype not found' });
      return;
    }
    res.json(archetype);
  }

  public getStaticArchetype(id: string): ArchetypeInfo | undefined {
    return ARCHETYPES.find((a) => a.id === id);
  }
}
