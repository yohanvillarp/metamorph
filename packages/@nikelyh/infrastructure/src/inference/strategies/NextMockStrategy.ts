import { MockTransformContext, MockTransformStrategy } from './types';

export class NextMockStrategy implements MockTransformStrategy {
  readonly id = 'next';

  canHandle(ctx: MockTransformContext): boolean {
    return (ctx.targetFramework || '').toLowerCase() === 'next';
  }

  transform(ctx: MockTransformContext): string {
    let content = ctx.sourceContent;

    const hasClientHooks = /use(State|Effect|Callback|Memo|Ref|Context|Reducer)/.test(content);
    const hasDomEvents = /on(Click|Change|Submit|KeyDown|KeyUp|MouseEnter)/.test(content);
    const hasUseClient = /['"]use client['"]/.test(content);

    if ((hasClientHooks || hasDomEvents) && !hasUseClient) {
      content = "'use client';\n\n" + content;
    }

    if (content.includes('react-router-dom') || content.includes('react-router')) {
      content = content.replace(
        /from\s+['"]react-router(-dom)?['"]/g,
        "from 'next/navigation'"
      );
    }

    return content;
  }
}
