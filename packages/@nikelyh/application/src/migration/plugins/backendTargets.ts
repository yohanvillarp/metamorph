import * as fs from 'fs';
import * as path from 'path';
import type { MigrationPlugin, StructureIssue } from '../types';

function readIfExists(...candidates: string[]): { filePath: string; content: string } | null {
  for (const filePath of candidates) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return { filePath, content: fs.readFileSync(filePath, 'utf-8') };
    }
  }
  return null;
}

function leftoverDependencyImports(shadowRoot: string, forbidden: RegExp, label: string): StructureIssue[] {
  const pkgPath = path.join(shadowRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    const hits = Object.keys(all).filter((dep) => forbidden.test(dep));
    if (hits.length === 0) return [];
    return [{
      filePath: pkgPath,
      errors: [`package.json still lists ${label} dependencies (${hits.join(', ')}). Remove them.`],
    }];
  } catch {
    return [];
  }
}

function leftoverScripts(shadowRoot: string, forbidden: RegExp, message: string): StructureIssue[] {
  const pkgPath = path.join(shadowRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
    const hits = Object.entries(pkg.scripts || {}).filter(([, cmd]) => forbidden.test(cmd));
    if (hits.length === 0) return [];
    return [{
      filePath: pkgPath,
      errors: [`${message} (${hits.map(([name]) => name).join(', ')}).`],
    }];
  } catch {
    return [];
  }
}

// ── Express Target ──────────────────────────────────────────────────────────

export function analyzeExpressTarget(shadowRoot: string): StructureIssue[] {
  const issues: StructureIssue[] = [
    ...leftoverDependencyImports(shadowRoot, /@nestjs\/|fastify/, 'NestJS/Fastify'),
    ...leftoverScripts(shadowRoot, /\bnest\b/, 'package.json still runs NestJS scripts; Express target must not depend on nest CLI'),
  ];

  const main = readIfExists(
    path.join(shadowRoot, 'src', 'main.ts'),
    path.join(shadowRoot, 'src', 'index.ts'),
    path.join(shadowRoot, 'src', 'server.ts'),
    path.join(shadowRoot, 'src', 'app.ts'),
    path.join(shadowRoot, 'main.ts'),
    path.join(shadowRoot, 'index.ts'),
    path.join(shadowRoot, 'server.ts'),
    path.join(shadowRoot, 'app.ts'),
  );

  if (!main) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'main.ts'),
      errors: ['Missing Express entry point. Create src/main.ts (or index.ts/server.ts/app.ts) that creates express(), mounts routers, and calls app.listen().'],
    });
    return issues;
  }

  if (!/express\(\s*\)|from\s+['"]express['"]|require\s*\(\s*['"]express['"]\s*\)/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry file does not instantiate express(). The Express target must import and call express() to create the application.'],
    });
  }

  if (!/\.listen\s*\(/.test(main.content) && !/export/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry file neither calls app.listen() nor exports the app. The server will not start.'],
    });
  }

  if (/NestFactory|@nestjs\//.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry still references NestFactory or @nestjs imports. Replace with express() bootstrap.'],
    });
  }

  if (/fastify\(\s*\)|from\s+['"]fastify['"]/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry still references Fastify. Replace with express() bootstrap.'],
    });
  }

  return issues;
}

export function expressFileHint(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (/\/(main|index|server|app)\.(t|j)s$/.test(normalized) && !/\.spec\./.test(normalized)) {
    return `
This is the Express entry. It must:
1. Import express and create the app with express()
2. Mount routers with app.use()
3. Call app.listen() or export the app for testing
Do not leave NestFactory.create() or fastify() calls.
`;
  }
  return '';
}

// ── Fastify Target ──────────────────────────────────────────────────────────

export function analyzeFastifyTarget(shadowRoot: string): StructureIssue[] {
  const issues: StructureIssue[] = [
    ...leftoverDependencyImports(shadowRoot, /@nestjs\//, 'NestJS'),
    ...leftoverDependencyImports(shadowRoot, /^express$/, 'Express'),
    ...leftoverScripts(shadowRoot, /\bnest\b/, 'package.json still runs NestJS scripts; Fastify target must not depend on nest CLI'),
  ];

  const main = readIfExists(
    path.join(shadowRoot, 'src', 'main.ts'),
    path.join(shadowRoot, 'src', 'index.ts'),
    path.join(shadowRoot, 'src', 'server.ts'),
    path.join(shadowRoot, 'src', 'app.ts'),
    path.join(shadowRoot, 'main.ts'),
    path.join(shadowRoot, 'index.ts'),
    path.join(shadowRoot, 'server.ts'),
    path.join(shadowRoot, 'app.ts'),
  );

  if (!main) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'main.ts'),
      errors: ['Missing Fastify entry point. Create src/main.ts (or index.ts/server.ts/app.ts) that creates a Fastify instance, registers plugins, and calls fastify.listen().'],
    });
    return issues;
  }

  if (!/fastify\(\s*\)|Fastify\(\s*\)|from\s+['"]fastify['"]|require\s*\(\s*['"]fastify['"]\s*\)/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry file does not instantiate Fastify. The Fastify target must import and call Fastify() to create the server.'],
    });
  }

  if (!/\.listen\s*\(/.test(main.content) && !/export/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry file neither calls fastify.listen() nor exports the instance. The server will not start.'],
    });
  }

  if (/NestFactory|@nestjs\//.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry still references NestFactory or @nestjs imports. Replace with Fastify() bootstrap.'],
    });
  }

  if (/express\(\s*\)|from\s+['"]express['"]/.test(main.content) && !/from\s+['"]@fastify\/express['"]/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry still references Express. Replace with Fastify() bootstrap.'],
    });
  }

  return issues;
}

export function fastifyFileHint(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (/\/(main|index|server|app)\.(t|j)s$/.test(normalized) && !/\.spec\./.test(normalized)) {
    return `
This is the Fastify entry. It must:
1. Import Fastify and create the instance with Fastify()
2. Register route plugins with fastify.register()
3. Call fastify.listen() or export the instance for testing
Do not leave NestFactory.create() or express() calls.
`;
  }
  return '';
}

// ── NestJS Target ───────────────────────────────────────────────────────────

export function analyzeNestjsTarget(shadowRoot: string): StructureIssue[] {
  const issues: StructureIssue[] = [];

  const main = readIfExists(
    path.join(shadowRoot, 'src', 'main.ts'),
    path.join(shadowRoot, 'src', 'app.ts'),
    path.join(shadowRoot, 'main.ts'),
    path.join(shadowRoot, 'app.ts'),
    path.join(shadowRoot, 'index.ts'),
    path.join(shadowRoot, 'server.ts'),
  );

  if (!main) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'main.ts'),
      errors: ['Missing NestJS entry point. Create src/main.ts with NestFactory.create(AppModule) and app.listen().'],
    });
    return issues;
  }

  if (!/NestFactory\.create/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry file does not call NestFactory.create(). NestJS must bootstrap from NestFactory.'],
    });
  }

  const appModule = readIfExists(
    path.join(shadowRoot, 'src', 'app.module.ts'),
  );

  if (!appModule) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'app.module.ts'),
      errors: ['Missing src/app.module.ts. NestJS requires a root @Module() that imports controllers and providers.'],
    });
  } else if (!/@Module\s*\(/.test(appModule.content)) {
    issues.push({
      filePath: appModule.filePath,
      errors: ['app.module.ts does not contain a @Module() decorator. The root module must be decorated.'],
    });
  }

  if (/express\(\s*\)|from\s+['"]express['"]/.test(main.content) && !/platform-express/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry still directly instantiates Express. NestJS manages Express internally via @nestjs/platform-express.'],
    });
  }

  if (/fastify\(\s*\)|from\s+['"]fastify['"]/.test(main.content) && !/platform-fastify/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry still directly instantiates Fastify. NestJS manages Fastify internally via @nestjs/platform-fastify.'],
    });
  }

  return issues;
}

export function nestjsFileHint(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (/\/main\.(t|j)s$/.test(normalized)) {
    return `
This is the NestJS entry. It must:
1. Call NestFactory.create(AppModule)
2. Call app.listen() on the returned instance
Do not leave express() or Fastify() calls.
`;
  }
  if (/app\.module\.(t|j)s$/.test(normalized)) {
    return `
This is the root NestJS module. It must:
1. Be decorated with @Module()
2. Import all controllers in the controllers array
3. Import all providers/services in the providers array
`;
  }
  return '';
}

// ── Hono Target ────────────────────────────────────────────────────────────

export function analyzeHonoTarget(shadowRoot: string): StructureIssue[] {
  const issues: StructureIssue[] = [
    ...leftoverDependencyImports(shadowRoot, /@nestjs\//, 'NestJS'),
    ...leftoverDependencyImports(shadowRoot, /^express$/, 'Express'),
    ...leftoverDependencyImports(shadowRoot, /^fastify$/, 'Fastify'),
    ...leftoverScripts(shadowRoot, /\bnest\b/, 'package.json still runs NestJS scripts; Hono target must not depend on nest CLI'),
  ];

  const main = readIfExists(
    path.join(shadowRoot, 'src', 'main.ts'),
    path.join(shadowRoot, 'src', 'index.ts'),
    path.join(shadowRoot, 'src', 'server.ts'),
    path.join(shadowRoot, 'src', 'app.ts'),
    path.join(shadowRoot, 'main.ts'),
    path.join(shadowRoot, 'index.ts'),
    path.join(shadowRoot, 'server.ts'),
    path.join(shadowRoot, 'app.ts'),
  );

  if (!main) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'index.ts'),
      errors: ['Missing Hono entry point. Create src/index.ts (or main.ts/server.ts/app.ts) that creates new Hono(), registers routes, and calls serve().'],
    });
    return issues;
  }

  if (!/new\s+Hono\s*\(|from\s+['"]hono['"]|require\s*\(\s*['"]hono['"]\s*\)/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry file does not instantiate Hono. The Hono target must import { Hono } from "hono" and create new Hono().'],
    });
  }

  if (!/serve\s*\(/.test(main.content) && !/export/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry file neither calls serve() from "@hono/node-server" nor exports the app. The server will not start.'],
    });
  }

  if (/NestFactory|@nestjs\//.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry still references NestFactory or @nestjs imports. Replace with new Hono() bootstrap.'],
    });
  }

  if (/express\(\s*\)|from\s+['"]express['"]/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry still references Express. Replace with new Hono() bootstrap.'],
    });
  }

  if (/fastify\(\s*\)|Fastify\(\s*\)|from\s+['"]fastify['"]/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Entry still references Fastify. Replace with new Hono() bootstrap.'],
    });
  }

  return issues;
}

export function honoFileHint(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (/\/(main|index|server|app)\.(t|j)s$/.test(normalized) && !/\.spec\./.test(normalized)) {
    return `
This is the Hono entry. It must:
1. Import { Hono } from 'hono' and create the app with new Hono()
2. Register routes with app.get(), app.post(), or mount sub-apps with app.route()
3. Call serve({ fetch: app.fetch, port }) from '@hono/node-server' or export the app
Do not leave NestFactory.create(), express(), or Fastify() calls.
`;
  }
  return '';
}

// ── Plugin Exports ──────────────────────────────────────────────────────────

export const expressTargetPlugin: MigrationPlugin = {
  id: 'target-express',
  target: 'express',
  layer: 'backend',
  fileHint(filePath) {
    return expressFileHint(filePath);
  },
  verifyShadow(shadowRoot) {
    return analyzeExpressTarget(shadowRoot);
  },
  repairTargets(shadowRoot) {
    return [
      path.join(shadowRoot, 'package.json'),
      path.join(shadowRoot, 'src', 'main.ts'),
      path.join(shadowRoot, 'src', 'index.ts'),
      path.join(shadowRoot, 'src', 'server.ts'),
      path.join(shadowRoot, 'src', 'app.ts'),
      path.join(shadowRoot, 'main.ts'),
      path.join(shadowRoot, 'index.ts'),
      path.join(shadowRoot, 'server.ts'),
      path.join(shadowRoot, 'app.ts'),
    ];
  },
};

export const fastifyTargetPlugin: MigrationPlugin = {
  id: 'target-fastify',
  target: 'fastify',
  layer: 'backend',
  fileHint(filePath) {
    return fastifyFileHint(filePath);
  },
  verifyShadow(shadowRoot) {
    return analyzeFastifyTarget(shadowRoot);
  },
  repairTargets(shadowRoot) {
    return [
      path.join(shadowRoot, 'package.json'),
      path.join(shadowRoot, 'src', 'main.ts'),
      path.join(shadowRoot, 'src', 'index.ts'),
      path.join(shadowRoot, 'src', 'server.ts'),
      path.join(shadowRoot, 'src', 'app.ts'),
      path.join(shadowRoot, 'main.ts'),
      path.join(shadowRoot, 'index.ts'),
      path.join(shadowRoot, 'server.ts'),
      path.join(shadowRoot, 'app.ts'),
    ];
  },
};

export const nestjsTargetPlugin: MigrationPlugin = {
  id: 'target-nestjs',
  target: 'nestjs',
  layer: 'backend',
  fileHint(filePath) {
    return nestjsFileHint(filePath);
  },
  verifyShadow(shadowRoot) {
    return analyzeNestjsTarget(shadowRoot);
  },
  repairTargets(shadowRoot) {
    return [
      path.join(shadowRoot, 'package.json'),
      path.join(shadowRoot, 'src', 'main.ts'),
      path.join(shadowRoot, 'src', 'app.ts'),
      path.join(shadowRoot, 'src', 'app.module.ts'),
      path.join(shadowRoot, 'main.ts'),
      path.join(shadowRoot, 'app.ts'),
      path.join(shadowRoot, 'index.ts'),
    ];
  },
};

export const honoTargetPlugin: MigrationPlugin = {
  id: 'target-hono',
  target: 'hono',
  layer: 'backend',
  fileHint(filePath) {
    return honoFileHint(filePath);
  },
  verifyShadow(shadowRoot) {
    return analyzeHonoTarget(shadowRoot);
  },
  repairTargets(shadowRoot) {
    return [
      path.join(shadowRoot, 'package.json'),
      path.join(shadowRoot, 'src', 'main.ts'),
      path.join(shadowRoot, 'src', 'index.ts'),
      path.join(shadowRoot, 'src', 'server.ts'),
      path.join(shadowRoot, 'src', 'app.ts'),
      path.join(shadowRoot, 'main.ts'),
      path.join(shadowRoot, 'index.ts'),
      path.join(shadowRoot, 'server.ts'),
      path.join(shadowRoot, 'app.ts'),
    ];
  },
};
