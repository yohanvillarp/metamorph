import { backendCatalog } from './backendCatalog';
import { frontendCatalog } from './frontendCatalog';
import { FRAMEWORK_METADATA } from './metadata';
import type { CatalogLayer, FrameworkId, MigrationCatalogEntry } from './types';

export interface SupportedFrameworkInfo {
  value: FrameworkId;
  label: string;
  group: CatalogLayer;
}

const ALL_DEFAULT_CATALOGS: MigrationCatalogEntry[] = [
  ...backendCatalog,
  ...frontendCatalog,
];

/**
 * Returns a mapping of all source frameworks to valid target frameworks.
 * Derived dynamically from registered catalog entries.
 */
export function getSupportedMigrations(
  catalogs: MigrationCatalogEntry[] = ALL_DEFAULT_CATALOGS
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const entry of catalogs) {
    if (!result[entry.source]) {
      result[entry.source] = [];
    }
    if (!result[entry.source].includes(entry.target)) {
      result[entry.source].push(entry.target);
    }
  }
  return result;
}

/**
 * Returns all unique frameworks registered across catalogs along with their metadata.
 */
export function getSupportedFrameworks(
  catalogs: MigrationCatalogEntry[] = ALL_DEFAULT_CATALOGS
): SupportedFrameworkInfo[] {
  const seen = new Set<FrameworkId>();
  for (const entry of catalogs) {
    seen.add(entry.source);
    seen.add(entry.target);
  }

  return Array.from(seen).map((framework) => {
    const meta = FRAMEWORK_METADATA[framework] || {
      label: framework,
      group: 'backend' as CatalogLayer,
    };
    return {
      value: framework,
      label: meta.label,
      group: meta.group,
    };
  });
}

/**
 * Returns valid migration targets for a given source framework.
 */
export function getTargetsForFramework(
  framework: string,
  catalogs: MigrationCatalogEntry[] = ALL_DEFAULT_CATALOGS
): string[] {
  const normalized = framework.toLowerCase();
  const targets = new Set<string>();
  for (const entry of catalogs) {
    if (entry.source.toLowerCase() === normalized) {
      targets.add(entry.target);
    }
  }
  return Array.from(targets);
}
