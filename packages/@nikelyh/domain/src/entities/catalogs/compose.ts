import { backendCatalog } from './backendCatalog';
import { frontendCatalog } from './frontendCatalog';
import { packForFramework } from './frameworks';
import { ALL_MIGRATION_RULES } from './layers/all';
import { BACKEND_LAYER_RULES } from './layers/backend';
import { FRONTEND_LAYER_RULES } from './layers/frontend';
import { labelForTargetRuntime, rulesForTargetRuntime } from './layers/runtimes';
import type { CatalogLayer, MigrationCatalogEntry, ResolvedMigrationCatalog, RuleKind, RuleSection } from './types';

function findPair(source: string, target: string): { pair: MigrationCatalogEntry; layer: CatalogLayer } | undefined {
  const src = source.toLowerCase();
  const tgt = target.toLowerCase();
  const match = (entry: MigrationCatalogEntry) =>
    entry.source.toLowerCase() === src && entry.target.toLowerCase() === tgt;

  const frontend = frontendCatalog.find(match);
  if (frontend) return { pair: frontend, layer: 'frontend' };
  const backend = backendCatalog.find(match);
  if (backend) return { pair: backend, layer: 'backend' };
  return undefined;
}

function unique(rules: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rule of rules) {
    const key = rule.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(rule);
  }
  return out;
}

function section(
  scope: RuleSection['scope'],
  label: string,
  kind: RuleKind,
  rules: string[],
  groups?: RuleSection['groups'],
): RuleSection | undefined {
  const cleaned = unique(rules);
  const groupRules = groups?.flatMap((group) => unique(group.rules)) ?? [];
  if (cleaned.length === 0 && groupRules.length === 0) return undefined;
  return {
    scope,
    label,
    kind,
    rules: cleaned.length > 0 ? cleaned : groupRules,
    groups: groups
      ?.map((group) => ({ heading: group.heading, rules: unique(group.rules) }))
      .filter((group) => group.rules.length > 0),
  };
}

function frameworkSections(id: string, role: 'source' | 'target'): RuleSection[] {
  const pack = packForFramework(id);
  if (!pack) return [];
  const label = `Framework: ${id} (${role})`;
  const built = section('framework', label, 'contract', [], [
    { heading: 'Contract', rules: pack.contract },
    { heading: 'Components', rules: pack.components },
    { heading: 'Routing', rules: pack.routing },
    { heading: 'Styling', rules: pack.styling },
    { heading: 'Do not', rules: pack.antiPatterns },
  ]);
  return built ? [built] : [];
}

export function composeRuleSections(
  layer: CatalogLayer,
  source: string,
  target: string,
  pairRules: string[],
): RuleSection[] {
  const layerRules = layer === 'frontend' ? FRONTEND_LAYER_RULES : BACKEND_LAYER_RULES;
  const runtimeRules = layer === 'frontend' ? rulesForTargetRuntime(target) : [];

  const sections: Array<RuleSection | undefined> = [
    section('all', 'All migrations', 'invariant', ALL_MIGRATION_RULES),
    section(layer, `${layer} migrations`, layer === 'frontend' ? 'invariant' : 'contract', layerRules),
  ];

  if (runtimeRules.length > 0) {
    sections.push(section('runtime', labelForTargetRuntime(target), 'contract', runtimeRules));
  }

  sections.push(...frameworkSections(source, 'source'));
  if (source.toLowerCase() !== target.toLowerCase()) {
    sections.push(...frameworkSections(target, 'target'));
  }

  sections.push(section('pair', `This pair: ${source} → ${target}`, 'mapping', pairRules));

  return sections.filter((item): item is RuleSection => Boolean(item));
}

export function formatCatalogRules(sections: RuleSection[]): string {
  return sections
    .map((section) => {
      const kind = section.kind ? ` [${section.kind}]` : '';
      const header = `${section.label}${kind}`;
      if (section.groups && section.groups.length > 0) {
        const body = section.groups
          .map((group) => `${group.heading}:\n${group.rules.map((rule) => `- ${rule}`).join('\n')}`)
          .join('\n');
        return `${header}\n${body}`;
      }
      return `${header}:\n${section.rules.map((rule) => `- ${rule}`).join('\n')}`;
    })
    .join('\n\n');
}

/**
 * Resolves a source→target pair and layers all → layer → runtime → framework → pair.
 * Returns undefined if that pair is not in the catalog (unsupported migration).
 */
export function resolveMigrationCatalog(source: string, target: string): ResolvedMigrationCatalog | undefined {
  const found = findPair(source, target);
  if (!found) return undefined;

  const ruleSections = composeRuleSections(found.layer, source, target, found.pair.architecturalRules);
  return {
    ...found.pair,
    layer: found.layer,
    ruleSections,
    architecturalRules: ruleSections.flatMap((section) => section.rules),
  };
}
