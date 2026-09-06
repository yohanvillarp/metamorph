import * as fs from 'fs';
import * as path from 'path';
import {
  createAgent,
  SituationSpecification,
  SituationContext,
  SituationHandler,
  Agent,
} from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';

// --- Specifications ---
class WhenMigrationStarted extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean { return event.type === SemanticEventName.MIGRATION_STARTED; }
}
class WhenFileMigrated extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean { return event.type === SemanticEventName.FILE_MIGRATED; }
}
class WhenFileReviewed extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean { return event.type === SemanticEventName.FILE_REVIEWED; }
}
class WhenFileRejected extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean { return event.type === SemanticEventName.FILE_REJECTED; }
}
class WhenFileFatalMismatch extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean { return event.type === SemanticEventName.FILE_FATAL_MISMATCH; }
}
class WhenMigrationCompleted extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean { return event.type === SemanticEventName.MIGRATION_COMPLETED; }
}

// --- Helper ---
function appendToReport(shadowDir: string | undefined, content: string) {
  if (!shadowDir) return;
  const reportPath = path.join(shadowDir, 'migration-report.md');
  try {
    fs.appendFileSync(reportPath, content + '\n', 'utf-8');
  } catch (e) {
    console.error('[ReporterAgent] Error writing to report:', e);
  }
}

// --- Processors ---
const startedProcessor = {
  async apply({ event }: SituationContext) {
    const p = event.payload as SemanticEventPayloads.MigrationStarted;
    if (!('shadowWorkspacePath' in p)) return;
    const shadowPath = (p as any).shadowWorkspacePath; // or add to domain if needed, keeping simple for now
    if (!shadowPath) return;
    
    const reportPath = path.join(shadowPath, 'migration-report.md');
    const header = `# Metamorph Migration Report
**Plan ID**: ${p.planId}
**Date Started**: ${new Date().toLocaleString()}
---

## Migration Log

`;
    fs.writeFileSync(reportPath, header, 'utf-8');
    console.log(`[ReporterAgent] Initialized report at ${reportPath}`);
  }
};

const migratedProcessor = {
  async apply({ event }: SituationContext) {
    const p = event.payload as SemanticEventPayloads.FileMigrated;
    // Assuming shadowWorkspacePath is globally available or we can resolve it. 
    // Since payloads like FILE_MIGRATED might not contain shadowWorkspacePath, 
    // we fetch it via the runtime state if needed.
    const { resolveRuntime } = await import('../runtime');
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(p.planId);
    if (!plan) return;
    const shadowDir = plan.targetPath; // shadow dir is stored in targetPath for shadow operations
    
    appendToReport(shadowDir, `- ⏳ **Refactored**: \`${p.filePath}\` (Pending Review)`);
  }
};

const reviewedProcessor = {
  async apply({ event }: SituationContext) {
    const p = event.payload as { planId: string; filePath: string; };
    const { resolveRuntime } = await import('../runtime');
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(p.planId);
    if (!plan) return;
    appendToReport(plan.targetPath, `- ✅ **Approved**: \`${p.filePath}\``);
  }
};

const rejectedProcessor = {
  async apply({ event }: SituationContext) {
    const p = event.payload as SemanticEventPayloads.FileRejected;
    const { resolveRuntime } = await import('../runtime');
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(p.planId);
    if (!plan) return;
    appendToReport(plan.targetPath, `- ⚠️ **Rejected**: \`${p.filePath}\`\n  > Errors: ${p.errors?.join(', ')}`);
  }
};

const fatalProcessor = {
  async apply({ event }: SituationContext) {
    const p = event.payload as SemanticEventPayloads.FileFatalMismatch;
    const { resolveRuntime } = await import('../runtime');
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(p.planId);
    if (!plan) return;
    appendToReport(plan.targetPath, `- ❌ **FATAL MISMATCH**: \`${p.filePath}\`\n  > Reason: ${p.reason}`);
  }
};

const completedProcessor = {
  async apply({ event }: SituationContext) {
    const p = event.payload as { planId: string; };
    const { resolveRuntime } = await import('../runtime');
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(p.planId);
    if (!plan) return;
    const totalFiles = plan.tasks ? plan.tasks.length : 0;
    const migratedFiles = plan.tasks ? plan.tasks.filter(t => t.status === 'completed').length : 0;
    
    const footer = `
---
## Migration Completed
**Date Finished**: ${new Date().toLocaleString()}
**Total Files**: ${totalFiles}
**Successfully Migrated**: ${migratedFiles}
`;
    appendToReport(plan.targetPath, footer);
  }
};

/**
 * Creates the ReporterAgent instance.
 */
export function createReporterAgent(): Agent {
  return createAgent({
    name: 'Reporter',
    capabilities: ['reporting'],
    instruction: 'You are the Reporter Agent. Your job is to compile a human-readable markdown report of the migration process.',
    tools: [], 
    handlers: [
      { specification: new WhenMigrationStarted(), processor: startedProcessor },
      { specification: new WhenFileMigrated(), processor: migratedProcessor },
      { specification: new WhenFileReviewed(), processor: reviewedProcessor },
      { specification: new WhenFileRejected(), processor: rejectedProcessor },
      { specification: new WhenFileFatalMismatch(), processor: fatalProcessor },
      { specification: new WhenMigrationCompleted(), processor: completedProcessor },
    ],
  });
}
