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

    // 2. Manage dependencies safely using npm commands
    const packageJsonPath = path.join(shadowDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const { spawn } = await import('node:child_process');
      
      const runCommandAsync = (cmd: string, args: string[]): Promise<void> => {
        return new Promise((resolve, reject) => {
          const proc = spawn(cmd, args, { cwd: shadowDir, stdio: 'ignore', shell: true });
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command ${cmd} ${args.join(' ')} failed with code ${code}`));
          });
          proc.on('error', reject);
        });
      };

      try {
        // Remove old dependencies
        let toRemove = [];
        if (catalogEntry.dependenciesToRemove) toRemove.push(...catalogEntry.dependenciesToRemove);
        if (catalogEntry.devDependenciesToRemove) toRemove.push(...catalogEntry.devDependenciesToRemove);
        
        if (toRemove.length > 0) {
          console.log(`[PackageManagerAgent] Uninstalling: ${toRemove.join(' ')}`);
          await runCommandAsync('npm', ['uninstall', ...toRemove]);
        }

        // Add new dependencies
        if (catalogEntry.dependenciesToAdd && Object.keys(catalogEntry.dependenciesToAdd).length > 0) {
          const deps = Object.entries(catalogEntry.dependenciesToAdd).map(([pkg, ver]) => `${pkg}@${ver}`);
          console.log(`[PackageManagerAgent] Installing dependencies (this may take a few minutes)...`);
          sendEvent({
            type: SemanticEventName.SYSTEM_LOG as any,
            producerId: participant.getId(),
            occurredAt: new Date(),
            payload: { planId: payload.planId, message: 'Downloading and installing dependencies (this may take a few minutes)...', level: 'info' }
          }, participant.getId());
          await runCommandAsync('npm', ['install', ...deps]);
        }

        if (catalogEntry.devDependenciesToAdd && Object.keys(catalogEntry.devDependenciesToAdd).length > 0) {
          const devDeps = Object.entries(catalogEntry.devDependenciesToAdd).map(([pkg, ver]) => `${pkg}@${ver}`);
          console.log(`[PackageManagerAgent] Installing devDependencies...`);
          await runCommandAsync('npm', ['install', '-D', ...devDeps]);
        }

        console.log(`[PackageManagerAgent] Successfully updated dependencies via npm.`);
        sendEvent({
          type: SemanticEventName.SYSTEM_LOG as any,
          producerId: participant.getId(),
          occurredAt: new Date(),
          payload: { planId: payload.planId, message: 'Dependencies installed successfully!', level: 'info' }
        }, participant.getId());
      } catch (err) {
        console.error(`[PackageManagerAgent] Error running npm commands:`, err);
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
