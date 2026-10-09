import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  analyzeExpressTarget,
  analyzeFastifyTarget,
  analyzeNestjsTarget,
  expressFileHint,
  fastifyFileHint,
  nestjsFileHint,
  expressTargetPlugin,
  fastifyTargetPlugin,
  nestjsTargetPlugin,
} from './backendTargets';

describe('Backend Migration Validation Plugins', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metamorph-backend-targets-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('target-express (analyzeExpressTarget)', () => {
    it('reports issue when entry point is missing', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
      const issues = analyzeExpressTarget(tmpDir);
      assert.ok(issues.length > 0);
      assert.ok(issues.some(i => i.errors.some(e => e.includes('Missing Express entry point'))));
    });

    it('reports issue when entry file does not instantiate express()', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
      fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'console.log("hello world");');

      const issues = analyzeExpressTarget(tmpDir);
      assert.ok(issues.some(i => i.errors.some(e => e.includes('does not instantiate express()'))));
    });

    it('reports issue when entry file neither listens nor exports the app', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'server.ts'),
        `import express from 'express';
const app = express();`
      );

      const issues = analyzeExpressTarget(tmpDir);
      assert.ok(issues.some(i => i.errors.some(e => e.includes('neither calls app.listen() nor exports the app'))));
    });

    it('flags leftover NestJS or Fastify dependencies in package.json', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'test-app',
          dependencies: {
            express: '^4.18.2',
            '@nestjs/common': '^10.0.0',
            fastify: '^4.0.0',
          },
          scripts: {
            start: 'nest start',
          },
        })
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'main.ts'),
        `import express from 'express';
const app = express();
app.listen(3000);`
      );

      const issues = analyzeExpressTarget(tmpDir);
      assert.ok(issues.some(i => i.errors.some(e => e.includes('NestJS/Fastify dependencies'))));
      assert.ok(issues.some(i => i.errors.some(e => e.includes('package.json still runs NestJS scripts'))));
    });

    it('passes cleanly for a valid Express application', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'express-clean',
          dependencies: { express: '^4.18.2' },
          devDependencies: { '@types/express': '^4.17.17' },
        })
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'app.ts'),
        `import express from 'express';
export const app = express();
app.listen(3000);`
      );

      const issues = analyzeExpressTarget(tmpDir);
      assert.strictEqual(issues.length, 0);
    });
  });

  describe('target-fastify (analyzeFastifyTarget)', () => {
    it('reports issue when entry point is missing', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-fastify' }));
      const issues = analyzeFastifyTarget(tmpDir);
      assert.ok(issues.some(i => i.errors.some(e => e.includes('Missing Fastify entry point'))));
    });

    it('reports issue when entry file does not instantiate Fastify()', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-fastify' }));
      fs.writeFileSync(path.join(tmpDir, 'src', 'app.ts'), 'console.log("no fastify");');

      const issues = analyzeFastifyTarget(tmpDir);
      assert.ok(issues.some(i => i.errors.some(e => e.includes('does not instantiate Fastify'))));
    });

    it('flags leftover direct express dependency while allowing @fastify/express', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'fastify-with-express-leftover',
          dependencies: {
            fastify: '^4.26.0',
            express: '^4.18.2',
            '@fastify/express': '^2.0.0',
          },
        })
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'app.ts'),
        `import Fastify from 'fastify';
const app = Fastify();
export default app;`
      );

      const issues = analyzeFastifyTarget(tmpDir);
      const pkgIssues = issues.filter(i => i.filePath.endsWith('package.json'));
      assert.ok(pkgIssues.length > 0);
      assert.ok(pkgIssues.some(i => i.errors.some(e => e.includes('Express dependencies (express)'))));
    });

    it('passes cleanly for a valid Fastify application with @fastify/express compat', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'fastify-clean',
          dependencies: {
            fastify: '^4.26.0',
            '@fastify/express': '^2.0.0',
          },
        })
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'main.ts'),
        `import Fastify from 'fastify';
const server = Fastify({ logger: true });
server.listen({ port: 3000 });
export default server;`
      );

      const issues = analyzeFastifyTarget(tmpDir);
      assert.strictEqual(issues.length, 0);
    });

    it('supports root-level app.ts or server.ts', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'fastify-root', dependencies: { fastify: '^4.0.0' } })
      );
      fs.writeFileSync(
        path.join(tmpDir, 'server.ts'),
        `import Fastify from 'fastify';
const app = Fastify();
app.listen({ port: 8080 });`
      );

      const issues = analyzeFastifyTarget(tmpDir);
      assert.strictEqual(issues.length, 0);
    });
  });

  describe('target-nestjs (analyzeNestjsTarget)', () => {
    it('reports issue when entry point is missing', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'nest-test' }));
      const issues = analyzeNestjsTarget(tmpDir);
      assert.ok(issues.some(i => i.errors.some(e => e.includes('Missing NestJS entry point'))));
    });

    it('reports issue when entry does not call NestFactory.create()', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'main.ts'), 'export const a = 1;');
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'app.module.ts'),
        `import { Module } from '@nestjs/common';
@Module({})
export class AppModule {}`
      );

      const issues = analyzeNestjsTarget(tmpDir);
      assert.ok(issues.some(i => i.errors.some(e => e.includes('does not call NestFactory.create()'))));
    });

    it('reports issue when src/app.module.ts is missing or missing @Module decorator', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'main.ts'),
        `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
NestFactory.create(AppModule);`
      );

      // Missing app.module.ts
      let issues = analyzeNestjsTarget(tmpDir);
      assert.ok(issues.some(i => i.errors.some(e => e.includes('Missing src/app.module.ts'))));

      // Without @Module decorator
      fs.writeFileSync(path.join(tmpDir, 'src', 'app.module.ts'), 'export class AppModule {}');
      issues = analyzeNestjsTarget(tmpDir);
      assert.ok(issues.some(i => i.errors.some(e => e.includes('does not contain a @Module() decorator'))));
    });

    it('passes cleanly without requiring nest-cli.json', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'app.module.ts'),
        `import { Module } from '@nestjs/common';
@Module({})
export class AppModule {}`
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'app.ts'),
        `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();`
      );

      // Assert nest-cli.json does NOT exist
      assert.strictEqual(fs.existsSync(path.join(tmpDir, 'nest-cli.json')), false);

      const issues = analyzeNestjsTarget(tmpDir);
      assert.strictEqual(issues.length, 0);
    });
  });

  describe('File hints and plugin registrations', () => {
    it('provides descriptive file hints for backend entry points and modules', () => {
      assert.ok(expressFileHint('src/main.ts').includes('Express entry'));
      assert.strictEqual(expressFileHint('src/utils.ts'), '');

      assert.ok(fastifyFileHint('src/app.ts').includes('Fastify entry'));
      assert.strictEqual(fastifyFileHint('src/test.spec.ts'), '');

      assert.ok(nestjsFileHint('src/main.ts').includes('NestJS entry'));
      assert.ok(nestjsFileHint('src/app.module.ts').includes('root NestJS module'));
      assert.strictEqual(nestjsFileHint('src/service.ts'), '');
    });

    it('plugins declare valid metadata and repairTargets', () => {
      const ctx = { source: 'any', target: 'any' };
      assert.strictEqual(expressTargetPlugin.id, 'target-express');
      assert.strictEqual(expressTargetPlugin.layer, 'backend');
      const expressTargets = expressTargetPlugin.repairTargets?.(tmpDir, ctx);
      assert.ok(expressTargets && expressTargets.length > 0);

      assert.strictEqual(fastifyTargetPlugin.id, 'target-fastify');
      assert.strictEqual(fastifyTargetPlugin.layer, 'backend');
      const fastifyTargets = fastifyTargetPlugin.repairTargets?.(tmpDir, ctx);
      assert.ok(fastifyTargets && fastifyTargets.length > 0);

      assert.strictEqual(nestjsTargetPlugin.id, 'target-nestjs');
      assert.strictEqual(nestjsTargetPlugin.layer, 'backend');
      const nestjsTargets = nestjsTargetPlugin.repairTargets?.(tmpDir, ctx);
      assert.ok(nestjsTargets && nestjsTargets.length > 0);
    });
  });
});
