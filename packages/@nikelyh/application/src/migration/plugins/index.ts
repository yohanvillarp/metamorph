import { registerMigrationPlugin } from '../registry';
import { expressTargetPlugin, fastifyTargetPlugin, nestjsTargetPlugin } from './backendTargets';
import { angularTargetPlugin, svelteTargetPlugin, vueTargetPlugin } from './frontendTargets';
import { nextToReactPlugin } from './nextToReact';
import { reactToNextPlugin } from './reactToNext';

export function registerBuiltinMigrationPlugins(): void {
  registerMigrationPlugin(reactToNextPlugin);
  registerMigrationPlugin(nextToReactPlugin);
  registerMigrationPlugin(vueTargetPlugin);
  registerMigrationPlugin(svelteTargetPlugin);
  registerMigrationPlugin(angularTargetPlugin);
  registerMigrationPlugin(expressTargetPlugin);
  registerMigrationPlugin(fastifyTargetPlugin);
  registerMigrationPlugin(nestjsTargetPlugin);
}
