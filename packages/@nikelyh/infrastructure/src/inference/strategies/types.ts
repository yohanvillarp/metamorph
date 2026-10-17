export interface MockTransformContext {
  filePath: string;
  sourceContent: string;
  sourceFramework?: string;
  targetFramework?: string;
  prompt: string;
}

export interface MockTransformStrategy {
  readonly id: string;
  canHandle(ctx: MockTransformContext): boolean;
  transform(ctx: MockTransformContext): string;
}

