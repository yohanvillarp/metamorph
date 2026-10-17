import { MockTransformContext, MockTransformStrategy } from './types';

export class FastifyMockStrategy implements MockTransformStrategy {
  readonly id = 'fastify';

  canHandle(ctx: MockTransformContext): boolean {
    const target = (ctx.targetFramework || '').toLowerCase();
    const source = (ctx.sourceFramework || '').toLowerCase();
    return target === 'fastify' && (source === 'express' || source === 'nestjs');
  }

  transform(ctx: MockTransformContext): string {
    let content = ctx.sourceContent;

    content = content.replace(/from\s+['"]express['"]/g, "from 'fastify'");
    content = content.replace(/require\(['"]express['"]\)/g, "require('fastify')");
    content = content.replace(/\bimport\s+express\b/g, 'import fastify');
    content = content.replace(/\bexpress\(\)/g, 'fastify()');

    return content;
  }
}
