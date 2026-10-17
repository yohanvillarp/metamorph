import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MockTransformRegistry,
  NextMockStrategy,
  FastifyMockStrategy,
  NestJsMockStrategy,
  HonoMockStrategy,
  GenericFallbackStrategy,
} from './index';

describe('MockTransformStrategy & Registry', () => {
  test('NextMockStrategy injects "use client" when React hooks or DOM events exist', () => {
    const strategy = new NextMockStrategy();
    const source = 'import React, { useState } from "react"; export function Comp() { const [s] = useState(0); return <div>{s}</div>; }';
    
    assert.equal(strategy.canHandle({ filePath: 'Comp.tsx', sourceContent: source, targetFramework: 'next', prompt: '' }), true);
    assert.equal(strategy.canHandle({ filePath: 'Comp.tsx', sourceContent: source, targetFramework: 'express', prompt: '' }), false);

    const result = strategy.transform({ filePath: 'Comp.tsx', sourceContent: source, targetFramework: 'next', prompt: '' });
    assert.ok(result.startsWith("'use client';\n\n"));
  });

  test('NextMockStrategy replaces react-router-dom with next/navigation', () => {
    const strategy = new NextMockStrategy();
    const source = 'import { useRouter } from "react-router-dom";';
    const result = strategy.transform({ filePath: 'Comp.tsx', sourceContent: source, targetFramework: 'next', prompt: '' });
    assert.ok(result.includes("from 'next/navigation'"));
  });

  test('FastifyMockStrategy adapts express imports to fastify', () => {
    const strategy = new FastifyMockStrategy();
    const source = 'import express from "express";\nconst app = express();';
    const ctx = { filePath: 'server.ts', sourceContent: source, sourceFramework: 'express', targetFramework: 'fastify', prompt: '' };

    assert.equal(strategy.canHandle(ctx), true);
    const result = strategy.transform(ctx);
    assert.ok(result.includes("from 'fastify'"));
    assert.ok(result.includes('import fastify'));
    assert.ok(result.includes('fastify()'));
  });

  test('NestJsMockStrategy adapts framework imports to @nestjs/common', () => {
    const strategy = new NestJsMockStrategy();
    const source = 'import { Router } from "express";';
    const ctx = { filePath: 'app.ts', sourceContent: source, sourceFramework: 'express', targetFramework: 'nestjs', prompt: '' };

    assert.equal(strategy.canHandle(ctx), true);
    const result = strategy.transform(ctx);
    assert.ok(result.includes("from '@nestjs/common'"));
  });

  test('HonoMockStrategy adapts framework imports and constructor', () => {
    const strategy = new HonoMockStrategy();
    const source = 'import express from "express";\nconst app = express();';
    const ctx = { filePath: 'server.ts', sourceContent: source, sourceFramework: 'express', targetFramework: 'hono', prompt: '' };

    assert.equal(strategy.canHandle(ctx), true);
    const result = strategy.transform(ctx);
    assert.ok(result.includes("from 'hono'"));
    assert.ok(result.includes('new Hono()'));
  });

  test('GenericFallbackStrategy prepends synthetic migration banner when no changes occur', () => {
    const strategy = new GenericFallbackStrategy();
    const source = 'console.log("plain code");';
    const ctx = { filePath: 'plain.ts', sourceContent: source, sourceFramework: 'angular', targetFramework: 'vue', prompt: '' };

    const result = strategy.transform(ctx);
    assert.ok(result.startsWith('// [metamorph-mock] Migrated plain.ts from angular to vue'));
    assert.ok(result.includes('console.log("plain code");'));
  });

  test('MockTransformRegistry allows custom strategy registration and precedence', () => {
    const registry = new MockTransformRegistry(false);

    registry.register({
      id: 'custom-transform',
      canHandle: (ctx) => ctx.targetFramework === 'custom',
      transform: () => 'CUSTOM_TRANSFORMED_CODE',
    });

    const output = registry.transform({
      filePath: 'test.ts',
      sourceContent: 'original',
      targetFramework: 'custom',
      prompt: '',
    });

    assert.equal(output, 'CUSTOM_TRANSFORMED_CODE');
  });
});
