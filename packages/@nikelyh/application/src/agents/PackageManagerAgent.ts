import * as fs from 'fs';
import * as path from 'path';
import {
  createAgent,
  SituationSpecification,
  SituationContext,
  SituationHandler,
  Agent,
} from '@mozaik-ai/core';
import { resolveRuntime } from '../runtime';
import { SemanticEventName, SemanticEventPayloads, findMigrationCatalogEntry } from '@nikelyh/domain';

/**
 * Specification to match the MIGRATION_STARTED event on the bus.
 */
class WhenMigrationStarts extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.MIGRATION_STARTED;
  }
}

/**
 * Processor for the PackageManagerAgent when a migration starts.
 */
const managePackagesProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.MigrationStarted;
    console.log(`[PackageManagerAgent] Managing dependencies and cleanup for Plan: ${payload.planId}`);
    
    const shadowDir = payload.shadowWorkspacePath || '';
    if (!shadowDir || !fs.existsSync(shadowDir)) {
      console.warn('[PackageManagerAgent] No valid shadow workspace provided. Skipping.');
      return;
    }

    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(payload.planId);
    if (!plan) {
      console.warn('[PackageManagerAgent] Migration plan not found.');
      return;
    }

    const catalogEntry = findMigrationCatalogEntry(plan.profile.source, plan.profile.target);
    if (!catalogEntry) {
      console.log(`[PackageManagerAgent] No catalog entry found for ${plan.profile.source} -> ${plan.profile.target}`);
      return;
    }

    // 1. Delete deprecated framework files
    if (catalogEntry.filesToDelete && catalogEntry.filesToDelete.length > 0) {
      for (const fileToDelete of catalogEntry.filesToDelete) {
        const fullPath = path.join(shadowDir, fileToDelete);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`[PackageManagerAgent] Deleted deprecated file: ${fileToDelete}`);
        }
      }
    }

    // 2. Manage dependencies in package.json
    const packageJsonPath = path.join(shadowDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkgData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        let modified = false;

        // Remove old dependencies
        if (catalogEntry.dependenciesToRemove && pkgData.dependencies) {
          for (const dep of catalogEntry.dependenciesToRemove) {
            if (pkgData.dependencies[dep]) {
              delete pkgData.dependencies[dep];
              console.log(`[PackageManagerAgent] Removed dependency: ${dep}`);
              modified = true;
            }
          }
        }
        if (catalogEntry.devDependenciesToRemove && pkgData.devDependencies) {
          for (const dep of catalogEntry.devDependenciesToRemove) {
            if (pkgData.devDependencies[dep]) {
              delete pkgData.devDependencies[dep];
              console.log(`[PackageManagerAgent] Removed devDependency: ${dep}`);
              modified = true;
            }
          }
        }

        // Add new dependencies
        if (catalogEntry.dependenciesToAdd) {
          pkgData.dependencies = pkgData.dependencies || {};
          for (const [dep, version] of Object.entries(catalogEntry.dependenciesToAdd)) {
            pkgData.dependencies[dep] = version;
            console.log(`[PackageManagerAgent] Added dependency: ${dep}@${version}`);
            modified = true;
          }
        }
        if (catalogEntry.devDependenciesToAdd) {
          pkgData.devDependencies = pkgData.devDependencies || {};
          for (const [dep, version] of Object.entries(catalogEntry.devDependenciesToAdd)) {
            pkgData.devDependencies[dep] = version;
            console.log(`[PackageManagerAgent] Added devDependency: ${dep}@${version}`);
            modified = true;
          }
        }

        if (modified) {
          fs.writeFileSync(packageJsonPath, JSON.stringify(pkgData, null, 2), 'utf-8');
          console.log(`[PackageManagerAgent] Successfully updated package.json`);
        }
      } catch (err) {
        console.error(`[PackageManagerAgent] Error modifying package.json:`, err);
      }
    } else {
      console.log(`[PackageManagerAgent] No package.json found at ${packageJsonPath}`);
    }
  },
};

const managePackagesHandler: SituationHandler = {
  specification: new WhenMigrationStarts(),
  processor: managePackagesProcessor,
};

/**
 * Creates the PackageManagerAgent instance.
 */
export function createPackageManagerAgent(): Agent {
  return createAgent({
    name: 'PackageManager',
    capabilities: ['package_management'],
    instruction: 'You are the Package Manager Agent. Your job is to resolve dependencies and clean up unused framework files.',
    tools: [], 
    handlers: [managePackagesHandler],
  });
}
