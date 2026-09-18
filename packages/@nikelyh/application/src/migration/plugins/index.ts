import { registerMigrationPlugin } from '../registry';
import { angularTargetPlugin, svelteTargetPlugin, vueTargetPlugin } from './frontendTargets';
import { nextToReactPlugin } from './nextToReact';
import { reactToNextPlugin } from './reactToNext';

export function registerBuiltinMigrationPlugins(): void {
  registerMigrationPlugin(reactToNextPlugin);
  registerMigrationPlugin(nextToReactPlugin);
  registerMigrationPlugin(vueTargetPlugin);
  registerMigrationPlugin(svelteTargetPlugin);
  registerMigrationPlugin(angularTargetPlugin);
}
