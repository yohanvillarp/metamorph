export type CatalogLayer = 'frontend' | 'backend';

/**
 * all → layer → runtime → framework → pair.
 * Put facts at the highest layer that is still true. Pair rules are mappings only.
 */
export type RuleScope = 'all' | CatalogLayer | 'runtime' | 'framework' | 'pair';

/** How agents should treat the rule: never-break vs how-it-boots vs how-to-map vs known-failure. */
export type RuleKind = 'invariant' | 'contract' | 'mapping' | 'anti-pattern';

export interface RuleGroup {
  heading: string;
  rules: string[];
}

export interface RuleSection {
  scope: RuleScope;
  label: string;
  kind: RuleKind;
  rules: string[];
  groups?: RuleGroup[];
}

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
  scriptsToUpdate?: Record<string, string>;
  scriptsToRemove?: string[];
  filesToScaffold?: Record<string, string>;
}

/**
 * Pair entry plus layered rules (all → layer → frameworks → pair).
 */
export interface ResolvedMigrationCatalog extends MigrationCatalogEntry {
  layer: CatalogLayer;
  ruleSections: RuleSection[];
}
