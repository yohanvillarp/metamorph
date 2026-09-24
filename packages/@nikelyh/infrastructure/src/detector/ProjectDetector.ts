import { resolve } from 'node:path';
import type { ProjectProfile } from '@nikelyh/domain';
import { resolveProjectRoot, detectMonorepo } from './WorkspaceResolver';
import { inspectManifest } from './ManifestInspector';
import { inspectStructure } from './StructureInspector';
import { evaluateAndDisambiguate } from './SubsumptionEngine';

export { resolveProjectRoot, detectMonorepo } from './WorkspaceResolver';
export { inspectManifest } from './ManifestInspector';
export { inspectStructure } from './StructureInspector';

export interface DetectedTech {
  framework: string;
  confidence: number;
  evidence: string[];
  profile?: ProjectProfile;
}

/**
 * Advanced multi-layer inspector for software projects.
 * Returns structured ProjectProfile candidates ordered by confidence.
 */
export function inspectProject(targetPath: string): ProjectProfile[] {
  const normalizedPath = resolveProjectRoot(targetPath);
  const monorepo = detectMonorepo(normalizedPath);
  const manifest = inspectManifest(normalizedPath);
  const structure = inspectStructure(normalizedPath, manifest.allDependencies, manifest.scripts);

  const profiles = evaluateAndDisambiguate(manifest, structure);

  // Attach monorepo metadata to each candidate profile
  for (const profile of profiles) {
    if (monorepo.isMonorepo) {
      profile.monorepo = monorepo;
    }
  }

  return profiles;
}

/**
 * Backwards-compatible detection function for CLI and REST API consumers.
 * Backed by the multi-phase Project Intelligence Engine.
 */
export function detectTechnologies(targetPath: string): DetectedTech[] {
  const profiles = inspectProject(targetPath);

  return profiles.map(p => ({
    framework: p.framework,
    confidence: p.confidence,
    evidence: p.evidence,
    profile: p,
  }));
}
