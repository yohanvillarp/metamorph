import * as path from 'node:path';
import { MockTransformContext, MockTransformStrategy } from './types';

export class GenericFallbackStrategy implements MockTransformStrategy {
  readonly id = 'generic-fallback';

  canHandle(): boolean {
    return true;
  }

  transform(ctx: MockTransformContext): string {
    const source = ctx.sourceFramework || 'source';
    const target = ctx.targetFramework || 'target';
    const fileName = path.basename(ctx.filePath);

    return `// [metamorph-mock] Migrated ${fileName} from ${source} to ${target}\n${ctx.sourceContent}`;
  }
}
