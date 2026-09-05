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
  },
  {
    source: 'nestjs',
    target: 'fastify',
    description: 'Migration from NestJS framework to a Fastify application structure.',
    filesToDelete: ['nest-cli.json', 'tsconfig.build.json'],
    dependenciesToRemove: ['@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs'],
    dependenciesToAdd: { 'fastify': 'latest' },
    devDependenciesToRemove: ['@nestjs/cli', '@nestjs/schematics', '@nestjs/testing', '@types/express', '@types/supertest', 'source-map-support', 'supertest'],
    devDependenciesToAdd: { 'fastify-plugin': 'latest' },
    architecturalRules: [
      'Remove all NestJS decorators (@Module, @Controller, @Injectable, @Get, @Post, etc.).',
      'Remove all NestJS core imports.',
      'The entry point (main.ts) must initialize a FastifyInstance (fastify()) instead of NestFactory.',
      'Controllers and routing logic must be converted to Fastify route declarations (fastify.get, fastify.post).',
      'Ideally, encapsulate routes and modules as Fastify plugins.',
      'Remove NestJS dependency injection; use standard JavaScript/TypeScript classes or functions passing dependencies directly.',
      'Ensure standard Fastify schema validation (JSON Schema) is added if types or DTOs are available.',
      'You are authorized to rename, create, or delete files to adhere to a standard fastify plugin-based directory structure.'
    ],
    examples: [
      {
        description: 'Converting a NestJS Controller to a Fastify Plugin',
        before: `import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('users')
export class UsersController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getUsers() {
    return this.appService.getUsers();
  }
}`,
        after: `import { FastifyInstance } from 'fastify';
import { AppService } from './app.service';

export default async function usersPlugin(fastify: FastifyInstance, options: any) {
  const appService = new AppService(); // Or inject via options

  fastify.get('/users', async (request, reply) => {
    return appService.getUsers();
  });
}`
      }
    ]
  },
  {
    source: 'express',
    target: 'fastify',
    description: 'Migration from a plain Express application to Fastify.',
    dependenciesToRemove: ['express'],
    dependenciesToAdd: { 'fastify': 'latest', 'fastify-plugin': 'latest' },
    devDependenciesToRemove: ['@types/express'],
    devDependenciesToAdd: {},
    architecturalRules: [
      'Replace all Express app instantiations with fastify().',
      'Replace Express middleware signatures (req, res, next) with Fastify hooks (onRequest, preHandler, etc.) or Fastify plugins.',
      'Replace Express routing (app.use(), app.get()) with Fastify routing (fastify.get(), fastify.register()).',
      'Replace Express response methods (res.send(), res.json()) with Fastify reply methods (reply.send()) or simply return the payload from the async handler.',
      'Migrate standard Express middlewares (like cors, helmet) to their Fastify native equivalents (@fastify/cors, @fastify/helmet) if they are present.',
      'You are authorized to rename, create, or delete files to restructure the Express app into modular Fastify plugins.'
    ],
    examples: [
      {
        description: 'Converting an Express Route to a Fastify Route',
        before: `const express = require('express');
const app = express();

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello Express' });
});

app.listen(3000);`,
        after: `import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/api/data', async (request, reply) => {
  return { message: 'Hello Fastify' };
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});`
      }
    ]
  },
  {
    source: 'fastify',
    target: 'express',
    description: 'Migration from a Fastify application to Express.',
    dependenciesToRemove: ['fastify', 'fastify-plugin'],
    dependenciesToAdd: { 'express': 'latest' },
    devDependenciesToRemove: [],
    devDependenciesToAdd: { '@types/express': 'latest' },
    architecturalRules: [
      'Replace all fastify() app instantiations with express().',
      'Replace Fastify hooks (onRequest, preHandler, etc.) with standard Express middleware signatures (req, res, next).',
      'Replace Fastify routing (fastify.get, fastify.register) with Express routing (app.get, express.Router().use).',
      'Replace Fastify reply methods (reply.send) or implicit returns with Express response methods (res.send, res.json).',
      'CRITICAL: Fastify catches async errors automatically. When migrating to Express, ensure all asynchronous route handlers use try/catch blocks passing the error to next(err), or wrap them in an async wrapper.',
      'You are authorized to rename, create, or delete files to restructure the Fastify plugins into standard Express routers.'
    ],
    examples: [
      {
        description: 'Converting a Fastify Route to an Express Route',
        before: `import Fastify from 'fastify';

const fastify = Fastify();

fastify.get('/api/data', async (request, reply) => {
  return { message: 'Hello Fastify' };
});

fastify.listen({ port: 3000 });`,
        after: `const express = require('express');
const app = express();

app.get('/api/data', async (req, res, next) => {
  try {
    res.json({ message: 'Hello Fastify' });
  } catch (err) {
    next(err);
  }
});

app.listen(3000);`
      }
    ]
  },
  {
    source: 'fastify',
    target: 'nestjs',
    description: 'Migration from Fastify framework to NestJS (using platform-express by default).',
    dependenciesToRemove: ['fastify', 'fastify-plugin'],
    dependenciesToAdd: {
      '@nestjs/common': 'latest',
      '@nestjs/core': 'latest',
      '@nestjs/platform-express': 'latest',
      'reflect-metadata': '^0.1.13',
      'rxjs': '^7.8.1'
    },
    devDependenciesToRemove: [],
    devDependenciesToAdd: {
      '@nestjs/cli': 'latest',
      '@nestjs/schematics': 'latest',
      '@nestjs/testing': 'latest',
      '@types/supertest': '^2.0.12',
      'source-map-support': '^0.5.21',
      'supertest': '^6.3.3'
    },
    architecturalRules: [
      'Fastify routing logic must be encapsulated in classes decorated with @Controller().',
      'Business logic must be encapsulated in classes decorated with @Injectable() (Providers/Services).',
      'All Controllers and Providers must be registered in a class decorated with @Module().',
      'Use NestJS decorators for routing (@Get(), @Post(), @Param(), @Body(), etc.) instead of fastify route definitions.',
      'Rely on NestJS dependency injection instead of Fastify decorators or options passing.',
      'The entry point must use NestFactory.create() to bootstrap the application, replacing fastify().',
      'You are authorized to rename, create, or delete files to adhere strictly to the NestJS directory and file structure conventions (e.g., app.module.ts, app.controller.ts, app.service.ts, main.ts).'
    ],
    examples: [
      {
        description: 'Converting a Fastify Plugin to a NestJS Controller and Service',
        before: `export default async function usersPlugin(fastify, options) {
  fastify.get('/users', async (request, reply) => {
    return { users: [] };
  });
}`,
        after: `import { Controller, Get, Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  getUsers() {
    return { users: [] };
  }
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUsers() {
    return this.usersService.getUsers();
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
