import { MetamorphConfig, InferencePort } from '@nikelyh/domain';
import { MockInferenceAdapter, MozaikLifecycleHook } from './MockInferenceAdapter';
import { MozaikInferenceAdapter, MozaikRuntimeMethods } from './MozaikInferenceAdapter';

/**
 * Factory for creating the appropriate InferencePort adapter based on Metamorph runtime configuration.
 */
export class InferenceFactory {
  static create(
    config?: MetamorphConfig,
    runtimeHooks?: MozaikRuntimeMethods & MozaikLifecycleHook
  ): InferencePort {
    const isMock =
      config?.model === 'mock' ||
      config?.mock === true ||
      process.env.METAMORPH_MOCK === '1' ||
      process.env.METAMORPH_MOCK === 'true';

    if (isMock) {
      return new MockInferenceAdapter(runtimeHooks);
    }

    if (!runtimeHooks || !runtimeHooks.runLoop) {
      // In tests or environments where MozaikRuntimeMethods are omitted, fallback to Mock
      return new MockInferenceAdapter(runtimeHooks);
    }

    return new MozaikInferenceAdapter(runtimeHooks);
  }
}
