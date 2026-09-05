export interface MigrationCatalogEntry {
  source: string;
  target: string;
  description: string;
  architecturalRules: string[];
  examples?: { before: string; after: string; description: string }[];
}

export const MigrationCatalog: MigrationCatalogEntry[] = [
  {
    source: 'nestjs',
    target: 'express',
    description: 'Migration from NestJS framework to a plain Express application structure.',
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
