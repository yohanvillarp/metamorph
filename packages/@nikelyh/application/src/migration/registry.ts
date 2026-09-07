import * as path from 'path';
import type { CatalogLayer, MigrationCatalogEntry } from '@nikelyh/domain';
import type { MigrationPlugin, MigrationPluginContext, StructureIssue } from './types';

const plugins: MigrationPlugin[] = [];

export function registerMigrationPlugin(plugin: MigrationPlugin): void {
  if (plugins.some((existing) => existing.id === plugin.id)) return;
  plugins.push(plugin);
}

export function matchingMigrationPlugins(
  source: string,
  target: string,
  layer?: CatalogLayer,
): MigrationPlugin[] {
  const src = source.toLowerCase();
  const tgt = target.toLowerCase();
  return plugins.filter((plugin) => {
    if (plugin.source && plugin.source.toLowerCase() !== src) return false;
    if (plugin.target && plugin.target.toLowerCase() !== tgt) return false;
    if (plugin.layer && layer && plugin.layer !== layer) return false;
    return true;
  });
}

export function collectFileHints(filePath: string, ctx: MigrationPluginContext, layer?: CatalogLayer): string {
  return matchingMigrationPlugins(ctx.source, ctx.target, layer)
    .map((plugin) => plugin.fileHint?.(filePath, ctx) ?? '')
    .filter(Boolean)
    .join('\n');
}

export function collectShadowIssues(shadowRoot: string, ctx: MigrationPluginContext, layer?: CatalogLayer): StructureIssue[] {
  return matchingMigrationPlugins(ctx.source, ctx.target, layer).flatMap(
    (plugin) => plugin.verifyShadow?.(shadowRoot, ctx) ?? [],
  );
}

function resolveShadowPath(shadowRoot: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(shadowRoot, filePath);
}

/**
 * Files Integration should reopen as Worker tasks after a failed shadow install/build.
 * Combines compiler-implicated paths, catalog verifier issues, plugin bootstrap files,
 * and catalog scaffolds — never a project-specific screen name.
 */
export function collectRepairTargets(
  shadowRoot: string,
  ctx: MigrationPluginContext,
  options: {
    implicated?: string[];
    issues?: StructureIssue[];
    catalog?: MigrationCatalogEntry;
    layer?: CatalogLayer;
  } = {},
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (filePath: string | undefined) => {
    if (!filePath) return;
    const abs = path.resolve(resolveShadowPath(shadowRoot, filePath));
    const key = abs.replace(/\\/g, '/').toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(abs);
  };

  for (const file of options.implicated ?? []) add(file);
  for (const issue of options.issues ?? []) add(issue.filePath);
  const hasPinpoint = (options.implicated?.length ?? 0) > 0 || (options.issues?.length ?? 0) > 0;
  if (!hasPinpoint) {
    for (const plugin of matchingMigrationPlugins(ctx.source, ctx.target, options.layer)) {
      for (const file of plugin.repairTargets?.(shadowRoot, ctx) ?? []) add(file);
    }
    if (options.catalog?.filesToScaffold) {
      for (const rel of Object.keys(options.catalog.filesToScaffold)) add(path.join(shadowRoot, rel));
    }
    add(path.join(shadowRoot, 'package.json'));
  }
  return out;
}

export type { MigrationPlugin, StructureIssue };
