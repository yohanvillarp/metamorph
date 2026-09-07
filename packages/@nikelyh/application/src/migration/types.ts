export interface StructureIssue {
  filePath: string;
  errors: string[];
}

export interface MigrationPluginContext {
  source: string;
  target: string;
}

/**
 * Optional hooks for a source/target (or a whole layer).
 * Register one plugin per concern — Integration and Worker discover them; they do not switch on framework names.
 */
export interface MigrationPlugin {
  id: string;
  source?: string;
  target?: string;
  layer?: 'frontend' | 'backend';
  fileHint?: (filePath: string, ctx: MigrationPluginContext) => string;
  verifyShadow?: (shadowRoot: string, ctx: MigrationPluginContext) => StructureIssue[];
  /**
   * Bootstrap / router files to reopen when install/build fails but the compiler
   * output does not name a source file. Paths may be absolute or shadow-relative.
   * Missing files are still valid — the Worker should create them.
   */
  repairTargets?: (shadowRoot: string, ctx: MigrationPluginContext) => string[];
}
