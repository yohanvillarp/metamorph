import { backendCatalog } from './backendCatalog';
import { frontendCatalog } from './frontendCatalog';
import { MigrationCatalogEntry } from './types';

// Combinamos ambos catálogos en uno solo para facilitar la búsqueda
export const MigrationCatalog: MigrationCatalogEntry[] = [
  ...backendCatalog,
  ...frontendCatalog,
];

/**
 * Helper to find a catalog entry.
 */
export function findMigrationCatalogEntry(source: string, target: string): MigrationCatalogEntry | undefined {
  return MigrationCatalog.find(
    entry => entry.source.toLowerCase() === source.toLowerCase() && entry.target.toLowerCase() === target.toLowerCase()
  );
}

export * from './types';
