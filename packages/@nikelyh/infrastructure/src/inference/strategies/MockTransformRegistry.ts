import { MockTransformContext, MockTransformStrategy } from './types';
import { NextMockStrategy } from './NextMockStrategy';
import { FastifyMockStrategy } from './FastifyMockStrategy';
import { NestJsMockStrategy } from './NestJsMockStrategy';
import { HonoMockStrategy } from './HonoMockStrategy';
import { GenericFallbackStrategy } from './GenericFallbackStrategy';

export class MockTransformRegistry {
  private strategies: MockTransformStrategy[] = [];
  private fallbackStrategy: MockTransformStrategy = new GenericFallbackStrategy();

  constructor(registerDefaults = true) {
    if (registerDefaults) {
      this.register(new NextMockStrategy());
      this.register(new FastifyMockStrategy());
      this.register(new NestJsMockStrategy());
      this.register(new HonoMockStrategy());
    }
  }

  register(strategy: MockTransformStrategy): void {
    // Prevent duplicate registrations
    this.strategies = this.strategies.filter((s) => s.id !== strategy.id);
    this.strategies.unshift(strategy);
  }

  setFallback(strategy: MockTransformStrategy): void {
    this.fallbackStrategy = strategy;
  }

  getStrategies(): readonly MockTransformStrategy[] {
    return this.strategies;
  }

  transform(ctx: MockTransformContext): string {
    let transformed = ctx.sourceContent;

    for (const strategy of this.strategies) {
      if (strategy.canHandle(ctx)) {
        transformed = strategy.transform({ ...ctx, sourceContent: transformed });
      }
    }

    if (transformed === ctx.sourceContent) {
      transformed = this.fallbackStrategy.transform(ctx);
    }

    return transformed;
  }
}

export const defaultMockTransformRegistry = new MockTransformRegistry(true);
