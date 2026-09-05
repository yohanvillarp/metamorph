export interface MigrationCatalogEntry {
  source: string;
  target: string;
  description: string;
  architecturalRules: string[];
  examples?: { before: string; after: string; description: string }[];
  filesToDelete?: string[];
  dependenciesToRemove?: string[];
  dependenciesToAdd?: Record<string, string>;
  devDependenciesToRemove?: string[];
  devDependenciesToAdd?: Record<string, string>;
}

export const MigrationCatalog: MigrationCatalogEntry[] = [
  {
    source: 'nestjs',
    target: 'express',
    description: 'Migration from NestJS framework to a plain Express application structure.',
    filesToDelete: ['nest-cli.json', 'tsconfig.build.json'],
    dependenciesToRemove: ['@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs'],
    dependenciesToAdd: { 'express': '^4.18.2' },
    devDependenciesToRemove: ['@nestjs/cli', '@nestjs/schematics', '@nestjs/testing', '@types/express', '@types/supertest', 'source-map-support', 'supertest'],
    devDependenciesToAdd: { '@types/express': '^4.17.17' },
    architecturalRules: [
      'Remove all NestJS decorators (@Module, @Controller, @Injectable, @Get, @Post, etc.).',
      'Remove all NestJS core imports (e.g., from "@nestjs/common" or "@nestjs/core").',
      'Controllers must be converted into Express Router factory functions or classes that return an Express Router.',
      'Modules must be converted to plain dependency composition functions or startup scripts that wire Routers together.',
      'Services/Providers must be converted to plain TypeScript classes or functions, with dependencies passed explicitly via constructors (manual dependency injection) since NestJS DI is gone.',
      'Make sure to export the router or the configured Express application, not a Nest module.'
    ],
    examples: [
      {
        description: 'Converting a NestJS Controller to an Express Router',
        before: `import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}`,
        after: `import { Router } from 'express';
import { AppService } from './app.service';

export function createAppRouter(appService: AppService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const result = appService.getHello();
    res.send(result);
  });

  return router;
}`
      }
    ]
  },
  {
    source: 'express',
    target: 'nestjs',
    description: 'Migration from a plain Express application to the NestJS framework.',
    dependenciesToRemove: ['express'],
    dependenciesToAdd: {
      '@nestjs/common': 'latest',
      '@nestjs/core': 'latest',
      '@nestjs/platform-express': 'latest',
      'reflect-metadata': '^0.1.13',
      'rxjs': '^7.8.1'
    },
    devDependenciesToRemove: ['@types/express'],
    devDependenciesToAdd: {
      '@nestjs/cli': 'latest',
      '@nestjs/schematics': 'latest',
      '@nestjs/testing': 'latest',
      '@types/supertest': '^2.0.12',
      'source-map-support': '^0.5.21',
      'supertest': '^6.3.3'
    },
    architecturalRules: [
      'Express routing logic must be encapsulated in classes decorated with @Controller().',
      'Business logic must be encapsulated in classes decorated with @Injectable() (Providers/Services).',
      'All Controllers and Providers must be registered in a class decorated with @Module().',
      'Use NestJS decorators for routing (@Get(), @Post(), @Param(), @Body(), etc.) instead of Express route definitions.',
      'Rely on NestJS dependency injection instead of manual class instantiation or function passing.',
      'The entry point must use NestFactory.create() to bootstrap the application, replacing app.listen().',
      'You are authorized to rename, create, or delete files to adhere strictly to the NestJS directory and file structure conventions (e.g., app.module.ts, app.controller.ts, app.service.ts, main.ts).'
    ],
    examples: [
      {
        description: 'Converting an Express Router to a NestJS Controller and Service',
        before: `import { Router } from 'express';
import { getHelloLogic } from './logic';

export function createAppRouter(): Router {
  const router = Router();
  router.get('/', (req, res) => {
    res.send(getHelloLogic());
  });
  return router;
}`,
        after: `import { Controller, Get, Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello from logic';
  }
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}`
      }
    ]
  }
];

/**
 * Helper to find a catalog entry.
 */
export function findMigrationCatalogEntry(source: string, target: string): MigrationCatalogEntry | undefined {
  return MigrationCatalog.find(
    entry => entry.source.toLowerCase() === source.toLowerCase() && entry.target.toLowerCase() === target.toLowerCase()
  );
}
