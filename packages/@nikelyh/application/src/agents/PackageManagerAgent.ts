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

    // 2. Manage dependencies safely using npm commands
    const packageJsonPath = path.join(shadowDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const { execSync } = require('child_process');
      const execOpts = { cwd: shadowDir, stdio: 'inherit' as const };

      try {
        // Remove old dependencies
        let toRemove = [];
        if (catalogEntry.dependenciesToRemove) toRemove.push(...catalogEntry.dependenciesToRemove);
        if (catalogEntry.devDependenciesToRemove) toRemove.push(...catalogEntry.devDependenciesToRemove);
        
        if (toRemove.length > 0) {
          console.log(`[PackageManagerAgent] Uninstalling: ${toRemove.join(' ')}`);
          execSync(`npm uninstall ${toRemove.join(' ')}`, execOpts);
        }

        // Add new dependencies
        if (catalogEntry.dependenciesToAdd && Object.keys(catalogEntry.dependenciesToAdd).length > 0) {
          const deps = Object.entries(catalogEntry.dependenciesToAdd).map(([pkg, ver]) => `${pkg}@${ver}`);
          console.log(`[PackageManagerAgent] Installing dependencies: ${deps.join(' ')}`);
          execSync(`npm install ${deps.join(' ')}`, execOpts);
        }

        if (catalogEntry.devDependenciesToAdd && Object.keys(catalogEntry.devDependenciesToAdd).length > 0) {
          const devDeps = Object.entries(catalogEntry.devDependenciesToAdd).map(([pkg, ver]) => `${pkg}@${ver}`);
          console.log(`[PackageManagerAgent] Installing devDependencies: ${devDeps.join(' ')}`);
          execSync(`npm install -D ${devDeps.join(' ')}`, execOpts);
        }

        console.log(`[PackageManagerAgent] Successfully updated dependencies via npm.`);
      } catch (err) {
        console.error(`[PackageManagerAgent] Error running npm commands:`, err);
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
