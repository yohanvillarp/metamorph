import {
  Agent,
  createAgent,
  SituationContext,
  SituationSpecification,
  Tool,
} from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';
import { resolveRuntime, runLoop, sendEvent, type PlanJournal, type ReportNote } from '../runtime';

function log(participantId: string, planId: string, message: string, level: 'info' | 'warning' | 'error' = 'info') {
  sendEvent({
    type: SemanticEventName.SYSTEM_LOG as any,
    producerId: participantId,
    occurredAt: new Date(),
    payload: { planId, message, level },
  }, participantId);
}

async function shadowPathFor(plan: { runId: string; targetPath?: string }, journal?: PlanJournal): Promise<string> {
  if (journal?.shadowPath) return journal.shadowPath;
  const { ShadowWorkspace } = await import('@nikelyh/infrastructure');
  return new ShadowWorkspace().getShadowPath(plan.runId);
}

function fallbackReport(params: {
  source: string;
  target: string;
  targetPath?: string;
  runId: string;
  phase?: string;
  tasks: Array<{ filePath: string; status: string; error?: string }>;
  notes: ReportNote[];
  startedAt: string;
}): string {
  const completed = params.tasks.filter((t) => t.status === 'completed');
  const failed = params.tasks.filter((t) => t.status === 'failed');
  const rejected = params.notes.filter((n) => n.outcome === 'rejected' || n.outcome === 'fatal');

  const fileLines = params.tasks
    .filter((t) => !t.filePath.startsWith('system:'))
    .slice(0, 40)
    .map((t) => `- \`${t.filePath}\` — ${t.status}${t.error ? ` (${t.error})` : ''}`)
    .join('\n');

  const riskLines = rejected.slice(0, 12).map((n) => `- \`${n.filePath}\`: ${n.detail || n.outcome}`).join('\n');

  return `# What changed

Metamorph migrated this project from **${params.source}** to **${params.target}**.
${params.phase === 'failed' ? '\n**Status:** shadow `npm run build` (or catalog checks) did not pass. Treat this as an incomplete migration.\n' : ''}
Your original files were not overwritten until you click **Apply Migration**. After apply, the result lives on a git branch named like \`metamorph/${params.runId}\`.

## How to run it

1. Apply the migration in the dashboard (or keep working in the shadow workspace).
2. From the project folder:
   \`\`\`bash
   npm install
   npm run dev
   \`\`\`
3. Open the URL the framework prints (\`next dev\` → port 3000, Vite → 5173).

## What we touched

- Files completed: ${completed.length}
- Files failed: ${failed.length}
- Started: ${params.startedAt}
- Finished: ${new Date().toLocaleString()}

${fileLines || '_No file tasks recorded._'}

## Watch out for

${riskLines || '- Review \`package.json\` scripts and the new entry files (layout/page or \`index.html\` + \`src/main.tsx\`).\n- Confirm global CSS still loads in the browser.'}

## Need a retry?

Discard in the dashboard and start a new run. Do not mix two shadow workspaces in the same tree.
`;
}

const STATUS_PASSED = '**Status:** Shadow `npm run build` passed.';
const STATUS_FAILED = '**Status:** Shadow `npm run build` (or catalog checks) did not pass. Treat this as an incomplete migration.';

function statusLine(phase?: string): string {
  return phase === 'failed' ? STATUS_FAILED : STATUS_PASSED;
}

function patchReportStatus(markdown: string, phase?: string): string {
  const line = statusLine(phase);
  const stripped = markdown.replace(/\n?\*\*Status:\*\*[^\n]*\n?/g, '\n');
  if (stripped.startsWith('# ')) {
    const nl = stripped.indexOf('\n');
    if (nl === -1) return `${stripped}\n\n${line}\n`;
    return `${stripped.slice(0, nl)}\n\n${line}${stripped.slice(nl)}`;
  }
  return `${line}\n\n${stripped.trimStart()}`;
}

async function writeOrPatchMigrationMd(
  dest: string,
  phase: string | undefined,
  fallback: string,
): Promise<'wrote' | 'patched' | 'missing'> {
  const fs = await import('node:fs');
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 80) {
    fs.writeFileSync(dest, patchReportStatus(fallback, phase), 'utf-8');
    return 'wrote';
  }
  const current = fs.readFileSync(dest, 'utf-8');
  fs.writeFileSync(dest, patchReportStatus(current, phase), 'utf-8');
  return 'patched';
}

class WhenMigrationStarted extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.MIGRATION_STARTED;
  }
}

class WhenFileMigrated extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_MIGRATED;
  }
}

class WhenFileReviewed extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_REVIEWED;
  }
}

class WhenFileRejected extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_REJECTED;
  }
}

class WhenFileFatalMismatch extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_FATAL_MISMATCH;
  }
}

class WhenIntegrationStarts extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.PHASE_INTEGRATION_STARTED;
  }
}

class WhenMigrationCompleted extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.MIGRATION_COMPLETED;
  }
}

class WhenOwnAnswer extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === 'model.answer' && event.producerId === participant.getId();
  }
}

const startedProcessor = {
  async apply({ event, participant }: SituationContext) {
    const p = event.payload as SemanticEventPayloads.MigrationStarted;
    const entry = resolveRuntime().state.journal(p.planId);
    if (p.shadowWorkspacePath) entry.shadowPath = p.shadowWorkspacePath;
    log(participant.getId(), p.planId, 'Reporter is on the bus. It will draft MIGRATION.md during install/build (one model call, in parallel with Integration).');
  },
};

const migratedProcessor = {
  async apply({ event }: SituationContext) {
    const p = event.payload as SemanticEventPayloads.FileMigrated;
    resolveRuntime().state.journal(p.planId).notes.push({ filePath: p.filePath, outcome: 'migrated' });
  },
};

const reviewedProcessor = {
  async apply({ event }: SituationContext) {
    const p = event.payload as { planId: string; filePath: string };
    resolveRuntime().state.journal(p.planId).notes.push({ filePath: p.filePath, outcome: 'approved' });
  },
};

const rejectedProcessor = {
  async apply({ event }: SituationContext) {
    const p = event.payload as SemanticEventPayloads.FileRejected;
    resolveRuntime().state.journal(p.planId).notes.push({
      filePath: p.filePath,
      outcome: 'rejected',
      detail: (p.errors || []).slice(0, 3).join('; '),
    });
  },
};

const fatalProcessor = {
  async apply({ event }: SituationContext) {
    const p = event.payload as SemanticEventPayloads.FileFatalMismatch;
    resolveRuntime().state.journal(p.planId).notes.push({ filePath: p.filePath, outcome: 'fatal', detail: p.reason });
  },
};

function draftPrompt(params: {
  reportAbs: string;
  plan: { profile: { source: string; target: string }; targetPath?: string; runId: string };
  notes: ReportNote[];
  draft: string;
}): string {
  const notable = params.notes
    .filter((n) => n.outcome === 'rejected' || n.outcome === 'fatal')
    .slice(-15)
    .map((n) => `${n.filePath}: ${n.detail || n.outcome}`)
    .join('\n');

  return `Write a user-facing migration briefing to this exact path:
${params.reportAbs}

Audience: the engineer who clicked Start Migration. They are not reading agent telemetry.
File migration is done; Integration is installing/building in parallel — you may say the shadow build is still running.

Migration: ${params.plan.profile.source} → ${params.plan.profile.target}
Project path: ${params.plan.targetPath || '(unknown)'}
Run id: ${params.plan.runId}

Include these sections, in this order, with markdown headings:
1. What changed — 1-2 short paragraphs in plain language
2. How to run it — concrete commands (npm install, npm run dev, which port if you can infer from package.json)
3. What we touched — group by area (routes, styles, config, dependencies). Do not dump every file as a checklist unless there are under 12 files.
4. Watch out for — honest risks from the notes below and from reading package.json / the new entry files
5. Next steps after Apply — git branch checkout if they applied, npm install on the real project

You may read package.json, README, src/app/layout.tsx, src/main.tsx, index.html, or MIGRATION.md if they exist.

Rejected / structure notes:
${notable || '(none recorded)'}

If the model cannot infer something, say so briefly. Do not invent URLs, secrets, or features.

A factual draft you may rewrite (keep facts, improve voice):
---
${params.draft}
---
When the file is written, stop.`;
}

const draftDuringInstallProcessor = {
  async apply({ event, participant }: SituationContext) {
    if (!(participant instanceof Agent)) return;
    const p = event.payload as { planId: string };
    const runtime = resolveRuntime();
    const board = runtime.state.journal(p.planId);
    if (board.reportLoopActive || board.reportStarted) return;

    const plan = await runtime.state.repository.getPlan(p.planId);
    if (!plan) return;

    const shadowPath = await shadowPathFor(plan, board);
    const draft = fallbackReport({
      source: plan.profile.source,
      target: plan.profile.target,
      targetPath: plan.targetPath,
      runId: plan.runId,
      phase: plan.phase,
      tasks: plan.tasks || [],
      notes: board.notes,
      startedAt: board.startedAt,
    });

    const tools = participant.getTools();
    if (tools.length === 0) {
      board.reportStarted = true;
      const fs = await import('node:fs');
      const path = await import('node:path');
      fs.writeFileSync(path.join(shadowPath, 'MIGRATION.md'), draft, 'utf-8');
      log(participant.getId(), p.planId, 'Reporter wrote a fallback MIGRATION.md (no file tools on the agent).');
      return;
    }

    board.reportStarted = true;
    board.reportLoopActive = true;
    log(participant.getId(), p.planId, 'Reporter is drafting MIGRATION.md while Integration runs npm install / build (one model call).');

    const reportAbs = `${shadowPath.replace(/\\/g, '/')}/MIGRATION.md`;
    const modelToUse = process.env.METAMORPH_MODEL || 'gpt-5.4';
    runLoop(participant.getId(), draftPrompt({ reportAbs, plan, notes: board.notes, draft }), {
      model: modelToUse,
      context: participant.getMemory().getContext(),
      tools,
    });

    setTimeout(async () => {
      const still = runtime.state.journals.get(p.planId);
      if (!still?.reportLoopActive) return;
      still.reportLoopActive = false;
      try {
        const path = await import('node:path');
        const dest = path.join(shadowPath, 'MIGRATION.md');
        const phase = still.pendingStatusPhase;
        await writeOrPatchMigrationMd(dest, phase, draft);
        still.pendingStatusPhase = undefined;
        log(participant.getId(), p.planId, 'Reporter draft timed out; kept fallback MIGRATION.md.', 'warning');
      } catch {
        /* ignore */
      }
    }, 90000);
  },
};

const ownAnswerProcessor = {
  async apply() {
    const runtime = resolveRuntime();
    for (const [planId, journal] of runtime.state.journals) {
      journal.reportLoopActive = false;
      if (!journal.pendingStatusPhase) continue;
      const plan = await runtime.state.repository.getPlan(planId);
      if (!plan) continue;
      const shadowPath = await shadowPathFor(plan, journal);
      const path = await import('node:path');
      const dest = path.join(shadowPath, 'MIGRATION.md');
      const draft = fallbackReport({
        source: plan.profile.source,
        target: plan.profile.target,
        targetPath: plan.targetPath,
        runId: plan.runId,
        phase: journal.pendingStatusPhase,
        tasks: plan.tasks || [],
        notes: journal.notes,
        startedAt: journal.startedAt,
      });
      await writeOrPatchMigrationMd(dest, journal.pendingStatusPhase, draft);
      journal.pendingStatusPhase = undefined;
    }
  },
};

const completedProcessor = {
  async apply({ event, participant }: SituationContext) {
    const p = event.payload as { planId: string };
    const runtime = resolveRuntime();
    const board = runtime.state.journal(p.planId);
    const plan = await runtime.state.repository.getPlan(p.planId);
    if (!plan) return;

    const shadowPath = await shadowPathFor(plan, board);
    const draft = fallbackReport({
      source: plan.profile.source,
      target: plan.profile.target,
      targetPath: plan.targetPath,
      runId: plan.runId,
      phase: plan.phase,
      tasks: plan.tasks || [],
      notes: board.notes,
      startedAt: board.startedAt,
    });

    board.pendingStatusPhase = plan.phase === 'failed' ? 'failed' : 'completed';

    try {
      const path = await import('node:path');
      const dest = path.join(shadowPath, 'MIGRATION.md');
      if (board.reportLoopActive) {
        log(participant.getId(), p.planId, 'Reporter draft is still running; Status will be patched when it finishes (no second model call).');
        return;
      }
      const result = await writeOrPatchMigrationMd(dest, plan.phase, draft);
      board.pendingStatusPhase = undefined;
      log(
        participant.getId(),
        p.planId,
        result === 'patched'
          ? 'Reporter patched MIGRATION.md with the final build Status (no extra model call).'
          : 'Reporter finished. Open MIGRATION.md in the shadow workspace (it is copied to your project when you Apply).',
      );
    } catch (error) {
      console.error('[ReporterAgent] Could not ensure MIGRATION.md:', error);
      log(participant.getId(), p.planId, 'Reporter could not write MIGRATION.md.', 'warning');
    }
  },
};

export function createReporterAgent(tools: Tool[] = []): Agent {
  return createAgent({
    name: 'Reporter',
    capabilities: ['reporting', 'inference'],
    instruction:
      'You are the Reporter on the Metamorph swarm. Watch the bus. When Integration starts, write MIGRATION.md for the human — not an internal log. Use write_file. Do not modify application source. Do not start extra model calls; one draft per run is enough.',
    tools,
    handlers: [
      { specification: new WhenMigrationStarted(), processor: startedProcessor },
      { specification: new WhenFileMigrated(), processor: migratedProcessor },
      { specification: new WhenFileReviewed(), processor: reviewedProcessor },
      { specification: new WhenFileRejected(), processor: rejectedProcessor },
      { specification: new WhenFileFatalMismatch(), processor: fatalProcessor },
      { specification: new WhenIntegrationStarts(), processor: draftDuringInstallProcessor },
      { specification: new WhenOwnAnswer(), processor: ownAnswerProcessor },
      { specification: new WhenMigrationCompleted(), processor: completedProcessor },
    ],
  });
}
