import { backendCatalog } from './backendCatalog';
import { frontendCatalog } from './frontendCatalog';
import { resolveMigrationCatalog } from './compose';
import { MigrationCatalogEntry } from './types';

export const MigrationCatalog: MigrationCatalogEntry[] = [
  ...backendCatalog,
  ...frontendCatalog,
];

/**
 * @deprecated Prefer resolveMigrationCatalog — same lookup, but layers all/layer/framework/pair rules.
 */
export function findMigrationCatalogEntry(source: string, target: string) {
  return resolveMigrationCatalog(source, target);
}

export * from './types';
export * from './compose';
export { ALL_MIGRATION_RULES } from './layers/all';
export { FRONTEND_LAYER_RULES } from './layers/frontend';
export { BACKEND_LAYER_RULES } from './layers/backend';
export {
  VITE_SPA_RUNTIME_RULES,
  NEXT_APP_RUNTIME_RULES,
  ANGULAR_CLI_RUNTIME_RULES,
  rulesForTargetRuntime,
  targetRuntimeFor,
} from './layers/runtimes';
export { FRAMEWORK_RULES, FRAMEWORK_PACKS, packForFramework, rulesForFramework } from './frameworks';
