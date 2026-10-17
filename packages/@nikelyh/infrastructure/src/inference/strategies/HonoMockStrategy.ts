import { MockTransformContext, MockTransformStrategy } from './types';

export class HonoMockStrategy implements MockTransformStrategy {
  readonly id = 'hono';

  canHandle(ctx: MockTransformContext): boolean {
    return (ctx.targetFramework || '').toLowerCase() === 'hono';
  }

  transform(ctx: MockTransformContext): string {
    let content = ctx.sourceContent;

    content = content.replace(/from\s+['"](express|fastify)['"]/g, "from 'hono'");
    content = content.replace(/require\(['"](express|fastify)['"]\)/g, "require('hono')");
    content = content.replace(/\b(express|fastify)\(\)/g, 'new Hono()');

    return content;
  }
}
