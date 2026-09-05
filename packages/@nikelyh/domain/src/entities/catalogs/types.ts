export interface MigrationCatalogEntry {
  source: string;
  target: string;
  description: string;
  architecturalRules: string[];
  examples?: { before: string; after: string; description: string }[];
  filesToDelete?: string[];
  dependenciesToRemove?: string[];
  dependenciesToAdd?: Record<string, string>;
  devDependenciesToRemove?: string[];
  devDependenciesToAdd?: Record<string, string>;
}
