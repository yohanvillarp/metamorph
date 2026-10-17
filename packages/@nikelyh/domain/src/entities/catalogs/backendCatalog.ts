import { MigrationCatalogEntry } from './types';

export const backendCatalog: MigrationCatalogEntry[] = [
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
      '@types/node': '^20.0.0',
      '@types/supertest': '^2.0.12',
      'source-map-support': '^0.5.21',
      'supertest': '^6.3.3'
    },
    scriptsToUpdate: {
      'build': 'tsc'
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
      '@types/node': '^20.0.0',
      '@types/supertest': '^2.0.12',
      'source-map-support': '^0.5.21',
      'supertest': '^6.3.3'
    },
    scriptsToUpdate: {
      'build': 'tsc'
    },
    scriptsToRemove: ['dev:start', 'watch:ts'],
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
  },
  // ── Hono migration pairs ─────────────────────────────────────────────────
  {
    source: 'express',
    target: 'hono',
    description: 'Migration from a plain Express application to Hono.',
    dependenciesToRemove: ['express'],
    dependenciesToAdd: { 'hono': 'latest', '@hono/node-server': 'latest' },
    devDependenciesToRemove: ['@types/express'],
    devDependenciesToAdd: {},
    architecturalRules: [
      'Replace all Express app instantiations (express()) with new Hono().',
      'Replace Express middleware signatures (req, res, next) with Hono middleware (c, next) using the Context object.',
      'Replace Express routing (app.get(), app.use(), Router()) with Hono routing (app.get(), app.route()).',
      'Replace Express response methods (res.json(), res.send(), res.status()) with Hono Context methods (c.json(), c.text(), c.status()).',
      'Replace app.listen() with serve() from "@hono/node-server".',
      'Request body is accessed via c.req.json() (async) instead of req.body.',
      'Route parameters are accessed via c.req.param("name") instead of req.params.name.',
      'Query parameters are accessed via c.req.query("name") instead of req.query.name.',
      'Migrate standard Express middlewares (cors, helmet) to Hono built-in middleware (hono/cors, hono/secure-headers) if present.',
      'You are authorized to rename, create, or delete files to restructure the Express app into Hono route groups.',
    ],
    examples: [
      {
        description: 'Converting an Express Route to a Hono Route',
        before: `import express from 'express';
const app = express();

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello Express' });
});

app.listen(3000);`,
        after: `import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

app.get('/api/data', (c) => {
  return c.json({ message: 'Hello Hono' });
});

serve({ fetch: app.fetch, port: 3000 });`,
      },
    ],
  },
  {
    source: 'hono',
    target: 'express',
    description: 'Migration from a Hono application to Express.',
    dependenciesToRemove: ['hono', '@hono/node-server'],
    dependenciesToAdd: { 'express': 'latest' },
    devDependenciesToRemove: [],
    devDependenciesToAdd: { '@types/express': 'latest' },
    architecturalRules: [
      'Replace all new Hono() instantiations with express().',
      'Replace Hono middleware (c, next) with Express middleware signatures (req, res, next).',
      'Replace Hono routing (app.get(), app.route()) with Express routing (app.get(), express.Router()).',
      'Replace Hono Context response methods (c.json(), c.text()) with Express response methods (res.json(), res.send()).',
      'Replace serve() from "@hono/node-server" with app.listen().',
      'CRITICAL: Hono catches async errors automatically via Context. When migrating to Express, ensure all asynchronous route handlers use try/catch blocks passing the error to next(err).',
      'Replace c.req.json() with req.body (add express.json() middleware).',
      'Replace c.req.param("name") with req.params.name.',
      'Replace c.req.query("name") with req.query.name.',
      'You are authorized to rename, create, or delete files to restructure Hono route groups into Express routers.',
    ],
    examples: [
      {
        description: 'Converting a Hono Route to an Express Route',
        before: `import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

app.get('/api/data', (c) => {
  return c.json({ message: 'Hello Hono' });
});

serve({ fetch: app.fetch, port: 3000 });`,
        after: `import express from 'express';

const app = express();

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello Express' });
});

app.listen(3000);`,
      },
    ],
  },
  {
    source: 'fastify',
    target: 'hono',
    description: 'Migration from a Fastify application to Hono.',
    dependenciesToRemove: ['fastify', 'fastify-plugin'],
    dependenciesToAdd: { 'hono': 'latest', '@hono/node-server': 'latest' },
    devDependenciesToRemove: [],
    devDependenciesToAdd: {},
    architecturalRules: [
      'Replace all Fastify() instantiations with new Hono().',
      'Replace Fastify hooks (onRequest, preHandler) with Hono middleware (app.use()).',
      'Replace Fastify routing (fastify.get(), fastify.register()) with Hono routing (app.get(), app.route()).',
      'Replace Fastify reply methods (reply.send()) or implicit returns with Hono Context methods (c.json(), c.text()).',
      'Replace fastify.listen() with serve() from "@hono/node-server".',
      'Convert Fastify plugins to Hono sub-apps: create a new Hono() instance and mount with app.route("/prefix", subApp).',
      'Replace request.body with c.req.json() (async).',
      'Replace Fastify JSON Schema validation with Hono validators (hono/validator) if present.',
      'You are authorized to rename, create, or delete files to restructure Fastify plugins into Hono route groups.',
    ],
    examples: [
      {
        description: 'Converting a Fastify Plugin to a Hono Route Group',
        before: `import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/api/data', async (request, reply) => {
  return { message: 'Hello Fastify' };
});

fastify.listen({ port: 3000 });`,
        after: `import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

app.get('/api/data', (c) => {
  return c.json({ message: 'Hello Hono' });
});

serve({ fetch: app.fetch, port: 3000 });`,
      },
    ],
  },
  {
    source: 'hono',
    target: 'fastify',
    description: 'Migration from a Hono application to Fastify.',
    dependenciesToRemove: ['hono', '@hono/node-server'],
    dependenciesToAdd: { 'fastify': 'latest' },
    devDependenciesToRemove: [],
    devDependenciesToAdd: { 'fastify-plugin': 'latest' },
    architecturalRules: [
      'Replace all new Hono() instantiations with Fastify().',
      'Replace Hono middleware (c, next) with Fastify hooks (onRequest, preHandler) or plugins.',
      'Replace Hono routing (app.get(), app.route()) with Fastify routing (fastify.get(), fastify.register()).',
      'Replace Hono Context response methods (c.json(), c.text()) with Fastify reply methods (reply.send()) or implicit returns.',
      'Replace serve() from "@hono/node-server" with fastify.listen().',
      'Convert Hono sub-apps (app.route("/prefix", subApp)) into Fastify plugins using fastify-plugin.',
      'Replace c.req.json() with request.body.',
      'You are authorized to rename, create, or delete files to restructure Hono route groups into Fastify plugins.',
    ],
    examples: [
      {
        description: 'Converting a Hono Route to a Fastify Route',
        before: `import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

app.get('/api/data', (c) => {
  return c.json({ message: 'Hello Hono' });
});

serve({ fetch: app.fetch, port: 3000 });`,
        after: `import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/api/data', async (request, reply) => {
  return { message: 'Hello Fastify' };
});

fastify.listen({ port: 3000 });`,
      },
    ],
  },
  {
    source: 'nestjs',
    target: 'hono',
    description: 'Migration from NestJS framework to a Hono application structure.',
    filesToDelete: ['nest-cli.json', 'tsconfig.build.json'],
    dependenciesToRemove: ['@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs'],
    dependenciesToAdd: { 'hono': 'latest', '@hono/node-server': 'latest' },
    devDependenciesToRemove: ['@nestjs/cli', '@nestjs/schematics', '@nestjs/testing', '@types/express', '@types/supertest', 'source-map-support', 'supertest'],
    devDependenciesToAdd: {},
    architecturalRules: [
      'Remove all NestJS decorators (@Module, @Controller, @Injectable, @Get, @Post, etc.).',
      'Remove all NestJS core imports (e.g., from "@nestjs/common" or "@nestjs/core").',
      'Controllers must be converted into Hono route groups: create a new Hono() sub-app with routes, then mount via app.route().',
      'Modules must be converted to plain composition functions that wire route groups together.',
      'Services/Providers must be converted to plain TypeScript classes or functions, with dependencies passed explicitly (manual DI).',
      'The entry point must create a new Hono() app and use serve() from "@hono/node-server" instead of NestFactory.create().',
      'You are authorized to rename, create, or delete files to adhere to a Hono route-group directory structure.',
    ],
    examples: [
      {
        description: 'Converting a NestJS Controller to a Hono Route Group',
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
        after: `import { Hono } from 'hono';
import { AppService } from './app.service';

const appService = new AppService();
const users = new Hono();

users.get('/', (c) => {
  return c.json(appService.getUsers());
});

export default users;`,
      },
    ],
  },
  {
    source: 'hono',
    target: 'nestjs',
    description: 'Migration from a Hono application to NestJS (using platform-express by default).',
    dependenciesToRemove: ['hono', '@hono/node-server'],
    dependenciesToAdd: {
      '@nestjs/common': 'latest',
      '@nestjs/core': 'latest',
      '@nestjs/platform-express': 'latest',
      'reflect-metadata': '^0.1.13',
      'rxjs': '^7.8.1',
    },
    devDependenciesToRemove: [],
    devDependenciesToAdd: {
      '@nestjs/cli': 'latest',
      '@nestjs/schematics': 'latest',
      '@nestjs/testing': 'latest',
      '@types/node': '^20.0.0',
      '@types/supertest': '^2.0.12',
      'source-map-support': '^0.5.21',
      'supertest': '^6.3.3',
    },
    scriptsToUpdate: {
      'build': 'tsc',
    },
    architecturalRules: [
      'Hono route handlers must be encapsulated in classes decorated with @Controller().',
      'Business logic must be encapsulated in classes decorated with @Injectable() (Providers/Services).',
      'All Controllers and Providers must be registered in a class decorated with @Module().',
      'Use NestJS decorators for routing (@Get(), @Post(), @Param(), @Body(), etc.) instead of Hono route definitions.',
      'Rely on NestJS dependency injection instead of manual class instantiation.',
      'The entry point must use NestFactory.create() to bootstrap the application, replacing serve() from "@hono/node-server".',
      'You are authorized to rename, create, or delete files to adhere strictly to the NestJS directory and file structure conventions (e.g., app.module.ts, app.controller.ts, app.service.ts, main.ts).',
    ],
    examples: [
      {
        description: 'Converting a Hono Route Group to a NestJS Controller and Service',
        before: `import { Hono } from 'hono';

const users = new Hono();

users.get('/', (c) => {
  return c.json({ users: [] });
});

export default users;`,
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
}`,
      },
    ],
  },
];
