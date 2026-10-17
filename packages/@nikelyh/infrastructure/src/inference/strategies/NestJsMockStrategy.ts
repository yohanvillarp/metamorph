import { MockTransformContext, MockTransformStrategy } from './types';

export class NestJsMockStrategy implements MockTransformStrategy {
  readonly id = 'nestjs';

  canHandle(ctx: MockTransformContext): boolean {
    const target = (ctx.targetFramework || '').toLowerCase();
    const source = (ctx.sourceFramework || '').toLowerCase();
    return target === 'nestjs' && (source === 'express' || source === 'fastify');
  }

  transform(ctx: MockTransformContext): string {
    let content = ctx.sourceContent;

    content = content.replace(/from\s+['"](express|fastify)['"]/g, "from '@nestjs/common'");
    content = content.replace(/require\(['"](express|fastify)['"]\)/g, "require('@nestjs/common')");

    return content;
  }
}
