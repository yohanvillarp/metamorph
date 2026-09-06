import * as fs from 'fs';
import * as path from 'path';
import {
  createAgent,
  SituationSpecification,
  SituationContext,
  SituationHandler,
  Agent,
} from '@mozaik-ai/core';
import { resolveRuntime, sendEvent } from '../runtime';
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

    // Mark system task as in_progress
    const pmTask = plan.tasks.find(t => t.filePath === 'system:package_manager');
    if (pmTask) {
      pmTask.status = 'in_progress';
      await runtime.state.repository.savePlan(plan);
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

    // 2. Manage dependencies by directly editing package.json (NO npm subprocess)
    // Running npm install/uninstall inside the shadow dir would cause npm to walk
    // upward and modify the REAL project's node_modules and package.json.
    const packageJsonPath = path.join(shadowDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkgRaw = fs.readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw);

        // Ensure sections exist
        if (!pkg.dependencies) pkg.dependencies = {};
        if (!pkg.devDependencies) pkg.devDependencies = {};

        // Remove old dependencies
        if (catalogEntry.dependenciesToRemove) {
          for (const dep of catalogEntry.dependenciesToRemove) {
            delete pkg.dependencies[dep];
            delete pkg.devDependencies[dep];
          }
        }
        if (catalogEntry.devDependenciesToRemove) {
          for (const dep of catalogEntry.devDependenciesToRemove) {
            delete pkg.dependencies[dep];
            delete pkg.devDependencies[dep];
          }
        }

        // Add new dependencies
        if (catalogEntry.dependenciesToAdd) {
          for (const [dep, ver] of Object.entries(catalogEntry.dependenciesToAdd)) {
            pkg.dependencies[dep] = ver;
          }
        }
        if (catalogEntry.devDependenciesToAdd) {
          for (const [dep, ver] of Object.entries(catalogEntry.devDependenciesToAdd)) {
            pkg.devDependencies[dep] = ver;
          }
        }

        // Clean up empty sections
        if (Object.keys(pkg.devDependencies).length === 0) delete pkg.devDependencies;

        // Update scripts
        if (catalogEntry.scriptsToUpdate) {
          if (!pkg.scripts) pkg.scripts = {};
          for (const [scriptName, scriptCmd] of Object.entries(catalogEntry.scriptsToUpdate)) {
            pkg.scripts[scriptName] = scriptCmd;
          }
        }

        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
        console.log(`[PackageManagerAgent] Updated package.json dependencies directly (no npm subprocess).`);

        sendEvent({
          type: SemanticEventName.SYSTEM_LOG as any,
          producerId: participant.getId(),
          occurredAt: new Date(),
          payload: { planId: payload.planId, message: 'Dependencies updated in package.json. Run "npm install" after applying the migration.', level: 'info' }
        }, participant.getId());
      } catch (err) {
        console.error(`[PackageManagerAgent] Error editing package.json:`, err);
      }
    } else {
      console.log(`[PackageManagerAgent] No package.json found at ${packageJsonPath}`);
    }

    // Mark system task as completed
    const currentPlan = await runtime.state.repository.getPlan(payload.planId);
    if (currentPlan) {
      const pmTaskToComplete = currentPlan.tasks.find(t => t.filePath === 'system:package_manager');
      if (pmTaskToComplete) {
        pmTaskToComplete.status = 'completed';
        await runtime.state.repository.savePlan(currentPlan);
      }

      // Check if ALL tasks are complete
      const allTerminal = currentPlan.tasks.every(t => t.status === 'completed' || t.status === 'failed');
      if (allTerminal) {
        console.log(`[App] All tasks reached terminal state. Emitting MIGRATION_COMPLETED.`);
        sendEvent({
          type: SemanticEventName.SYSTEM_LOG as any,
          producerId: participant.getId(),
          occurredAt: new Date(),
          payload: { planId: payload.planId, message: 'All agents have finished their work. Please review the results and click APPLY MIGRATION or DISCARD.', level: 'info' }
        }, participant.getId());

        sendEvent({
          type: SemanticEventName.MIGRATION_COMPLETED,
          producerId: participant.getId(),
          occurredAt: new Date(),
          payload: { planId: payload.planId },
        }, participant.getId());
      }
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
