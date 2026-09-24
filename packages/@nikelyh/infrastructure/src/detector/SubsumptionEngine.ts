import type { ProjectProfile } from '@nikelyh/domain';
import type { ManifestAnalysis } from './ManifestInspector';
import type { StructureAnalysis } from './StructureInspector';
import { FRAMEWORK_DETECTION_RULES, type FrameworkRule } from './rules/detectionRules';

interface ScoredCandidate {
  rule: FrameworkRule;
  score: number;
  evidence: string[];
  subsumed: string[];
}

export function evaluateAndDisambiguate(
  manifest: ManifestAnalysis,
  structure: StructureAnalysis
): ProjectProfile[] {
  const candidates: ScoredCandidate[] = [];

  for (const rule of FRAMEWORK_DETECTION_RULES) {
    // Require at least minimal base evidence (packages, characteristic source files, or dedicated config)
    const hasPackageMatch =
      rule.packageKeys.some(k => manifest.dependencies[k] || manifest.devDependencies[k]) ||
      (rule.devPackageKeys && rule.devPackageKeys.some(k => manifest.devDependencies[k])) ||
      (rule.framework === 'vue' && structure.extensionCounts.vue > 0) ||
      (rule.framework === 'svelte' && structure.extensionCounts.svelte > 0) ||
      (rule.framework === 'nestjs' && structure.extensionCounts.nestDecorators > 0);

    const hasDedicatedConfig = structure.existingConfigFiles.some(c =>
      rule.configPrefixes.some(p => p !== 'vite.config' && p !== 'webpack.config' && c.startsWith(p))
    );

    if (!hasPackageMatch && !hasDedicatedConfig) {
      continue; // Skip false positive on shared bundlers
    }

    let score = 0;
    const evidence: string[] = [];
    const subsumed: string[] = [];

    // 1. Check primary dependencies
    for (const key of rule.packageKeys) {
      if (manifest.dependencies[key]) {
        score += 50;
        evidence.push(`dependencies: "${key}": "${manifest.dependencies[key]}"`);
      } else if (manifest.devDependencies[key]) {
        score += 35;
        evidence.push(`devDependencies: "${key}": "${manifest.devDependencies[key]}"`);
      }
    }

    // 2. Check devPackageKeys (plugins, cli tooling)
    if (rule.devPackageKeys) {
      for (const devKey of rule.devPackageKeys) {
        if (manifest.devDependencies[devKey]) {
          score += 25;
          evidence.push(`devTooling: "${devKey}": "${manifest.devDependencies[devKey]}"`);
        }
      }
    }

    // 3. Check config files
    for (const prefix of rule.configPrefixes) {
      const match = structure.existingConfigFiles.find(c => c.startsWith(prefix));
      if (match) {
        score += 25;
        evidence.push(`config: ${match}`);
      }
    }

    // 4. Check router variant alignment
    if (rule.routerVariants && rule.routerVariants.includes(structure.routerVariant)) {
      score += 30;
      evidence.push(`router: ${structure.routerVariant}`);
    }

    // 5. Check characteristic extension files
    if (rule.framework === 'vue' && structure.extensionCounts.vue > 0) {
      score += 20;
      evidence.push(`source: found ${structure.extensionCounts.vue} .vue file(s)`);
    } else if (rule.framework === 'svelte' && structure.extensionCounts.svelte > 0) {
      score += 20;
      evidence.push(`source: found ${structure.extensionCounts.svelte} .svelte file(s)`);
    } else if (rule.framework === 'nestjs' && structure.extensionCounts.nestDecorators > 0) {
      score += 20;
      evidence.push(`source: found ${structure.extensionCounts.nestDecorators} nest decorator file(s)`);
    }

    if (score > 0) {
      candidates.push({
        rule,
        score,
        evidence,
        subsumed,
      });
    }
  }

  // ── Apply Subsumption DAG ──────────────────────────────────────────
  // If dominant framework is present with confidence, suppress subordinate frameworks
  for (const candidate of candidates) {
    if (candidate.rule.subsumes && candidate.score >= 50) {
      for (const subsumedTarget of candidate.rule.subsumes) {
        const targetCandidate = candidates.find(c => c.rule.framework === subsumedTarget);
        if (targetCandidate) {
          candidate.subsumed.push(subsumedTarget);
          candidate.evidence.push(
            `subsumed "${subsumedTarget}" as an internal runtime/driver of ${candidate.rule.framework}`
          );
          // Nullify or severely penalize subordinate candidate
          targetCandidate.score = 0;
        }
      }
    }
  }

  // Filter out suppressed candidates and sort descending by score
  const activeCandidates = candidates
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // Map to ProjectProfile objects
  return activeCandidates.map(c => {
    return {
      framework: c.rule.framework,
      category: c.rule.category,
      variant: structure.routerVariant,
      bundler: structure.bundler,
      packageManager: manifest.packageManager,
      language: manifest.language,
      hasTsConfig: manifest.hasTsConfig,
      pathAliases: manifest.pathAliases,
      confidence: Math.min(c.score, 100),
      evidence: c.evidence,
      subsumedDependencies: c.subsumed,
      suggestedTargets: c.rule.suggestedTargets,
    };
  });
}
