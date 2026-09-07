import {
  Agent,
  createAgent,
  SituationContext,
  SituationHandler,
  SituationSpecification,
  Tool,
} from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';
import { join, leave, resolveRuntime, runLoop, sendEvent } from '../runtime';

const MAX_INTEGRATION_ROUNDS = 4;
const REPAIR_TIMEOUT_MS = 120000;

class WhenIntegrationStarts extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.PHASE_INTEGRATION_STARTED;
  }
}

async function completeMigration(participantId: string, planId: string, message: string, level: 'info' | 'warning' | 'error') {
  const runtime = resolveRuntime();
  const plan = await runtime.state.repository.getPlan(planId);
  if (plan) {
    plan.phase = 'completed';
    await runtime.state.repository.savePlan(plan);
  }

  sendEvent({
    type: SemanticEventName.SYSTEM_LOG as any,
    producerId: participantId,
    occurredAt: new Date(),
    payload: { planId, message, level },
  }, participantId);

  sendEvent({
    type: SemanticEventName.MIGRATION_COMPLETED,
    producerId: participantId,
    occurredAt: new Date(),
    payload: { planId },
  }, participantId);
}

function log(participantId: string, planId: string, message: string, level: 'info' | 'warning' | 'error' = 'info') {
  sendEvent({
    type: SemanticEventName.SYSTEM_LOG as any,
    producerId: participantId,
    occurredAt: new Date(),
    payload: { planId, message, level },
  }, participantId);
}

async function failMigration(participantId: string, planId: string, message: string) {
  const runtime = resolveRuntime();
  const plan = await runtime.state.repository.getPlan(planId);
  if (plan) {
    plan.phase = 'failed';
    await runtime.state.repository.savePlan(plan);
  }

  log(participantId, planId, message, 'error');

  sendEvent({
    type: SemanticEventName.MIGRATION_COMPLETED,
    producerId: participantId,
    occurredAt: new Date(),
    payload: { planId },
  }, participantId);
}

async function requeueBrokenFiles(
  producerId: string,
  planId: string,
  files: string[],
  errors: string[],
) {
  const runtime = resolveRuntime();
  const unique = [...new Set(files.filter(Boolean))];
  log(
    producerId,
    planId,
    `Shadow install/build did not pass. Reopening ${unique.length} file task(s) for Worker repair.`,
    'warning'
  );

  for (const filePath of unique) {
    await runtime.state.repository.updateTaskStatus(
      planId,
      filePath,
      'pending',
      errors.slice(0, 3).join('\n').slice(0, 1500),
    );
    sendEvent({
      type: SemanticEventName.FILE_REJECTED,
      producerId: producerId,
      occurredAt: new Date(),
      payload: {
        planId,
        filePath,
        errors,
        source: 'integration',
      } as SemanticEventPayloads.FileRejected,
    }, producerId);
  }

  const plan = await runtime.state.repository.getPlan(planId);
  if (plan) {
    plan.phase = 'files';
    await runtime.state.repository.savePlan(plan);
  }
}

const integrationProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as { planId: string; shadowWorkspacePath?: string };
    const planId = payload.planId;
    const producerId = participant.getId();
    const locks = resolveRuntime().state.integrationLocks;

    if (locks.has(planId)) {
      console.log(`[IntegrationAgent] Integration already running for ${planId}. Ignoring duplicate phase event.`);
      return;
    }
    locks.add(planId);

    try {
      const runtime = resolveRuntime();
      const plan = await runtime.state.repository.getPlan(planId);
      if (!plan) {
        console.warn(`[IntegrationAgent] Plan ${planId} not found.`);
        return;
      }

      if (plan.phase === 'completed' || plan.phase === 'failed') {
        console.log(`[IntegrationAgent] Plan ${planId} already finished (${plan.phase}). Ignoring extra integration phase.`);
        return;
      }

      plan.phase = 'integration';

      const currentRound = plan.integrationRounds ?? 0;
      if (currentRound >= MAX_INTEGRATION_ROUNDS) {
        await failMigration(
          producerId,
          planId,
          `Integration budget exhausted after ${MAX_INTEGRATION_ROUNDS} shadow build rounds. npm run build still does not pass — the run is not successful.`,
        );
        return;
      }

      plan.integrationRounds = currentRound + 1;
      await runtime.state.repository.savePlan(plan);
      const lastRound = plan.integrationRounds >= MAX_INTEGRATION_ROUNDS;

      const { ShadowWorkspace, createReadFileTool, createWriteFileTool, createListDirectoryTool, createRunBuildTool, runInShadowWorkspace, parseImplicatedFiles } = await import('@nikelyh/infrastructure');
      const { collectShadowIssues, collectRepairTargets } = await import('../migration/registry');
      const { findMigrationCatalogEntry } = await import('@nikelyh/domain');
      const shadowPath = payload.shadowWorkspacePath || new ShadowWorkspace().getShadowPath(plan.runId);

      console.log(`[IntegrationAgent] Shadow build round ${plan.integrationRounds}/${MAX_INTEGRATION_ROUNDS} in ${shadowPath}`);
      log(producerId, planId, `File migration is done. Next: install dependencies in the shadow workspace (npm install). This can take several minutes — counters staying at 0 is expected.`);
      console.log(`[IntegrationAgent] npm install starting in ${shadowPath}`);

      let lastInstallBeat = Date.now();
      const install = await runInShadowWorkspace(shadowPath, 'npm install --no-fund --no-audit', (chunk) => {
        process.stdout.write(chunk);
        if (Date.now() - lastInstallBeat >= 15000) {
          lastInstallBeat = Date.now();
          log(producerId, planId, 'npm install is still running in the shadow workspace. Wait — this is not finished.');
        }
      });
      if (!install.ok) {
        console.warn('[IntegrationAgent] npm install failed in shadow:', install.output.slice(0, 2000));
        log(producerId, planId, 'npm install failed in the shadow workspace. Continuing to build anyway.', 'warning');
      } else {
        log(producerId, planId, 'npm install finished. Next: npm run build in the shadow workspace.');
      }

      let lastBuildBeat = Date.now();
      let build = await runInShadowWorkspace(shadowPath, 'npm run build', (chunk) => {
        process.stdout.write(chunk);
        if (Date.now() - lastBuildBeat >= 15000) {
          lastBuildBeat = Date.now();
          log(producerId, planId, 'npm run build is still running in the shadow workspace. Wait — this is not finished.');
        }
      });

      if (!build.ok) {
        log(producerId, planId, 'Shadow build failed. IntegrationAgent will attempt local repairs before requeueing files.');
        const shadowTools: Tool[] = [
          createReadFileTool(shadowPath),
          createWriteFileTool(shadowPath),
          createListDirectoryTool(shadowPath),
          createRunBuildTool(shadowPath),
        ];

        const { createAgent: createMozaikAgent } = await import('@mozaik-ai/core');
        await new Promise<void>((originalResolve) => {
          let isDone = false;
          const resolve = () => {
            if (!isDone) {
              isDone = true;
              originalResolve();
            }
          };

          const tempAgent = createMozaikAgent({
            name: `Integration-${Date.now()}`,
            capabilities: ['integration_testing', 'code_repair'],
            instruction: 'You are a staff engineer repairing a migrated project. Read failing files and their imports. Deduce real APIs from disk. Do not invent prop names. Do not wait for Git.',
            tools: shadowTools,
            handlers: [],
          });

          join(tempAgent);
          const modelToUse = process.env.METAMORPH_MODEL || 'gpt-5.4';
          const excerpt = build.output.slice(0, 4000);
          const prompt = `A real \`npm run build\` already failed in the shadow workspace at ${shadowPath}.
You must deduce the fix from source, not guess. Use list_directory / read_file on the implicated files AND the modules they import. Keep existing callback/export names. If a router file was reassembled, import the existing screen instead.

Do NOT require Git. You may run run_project_build again after edits.

Build output:
${excerpt}

When you have applied fixes (or cannot fix further), stop. A deterministic rebuild will run after you finish.`;

          Promise.resolve(runLoop(tempAgent.getId(), prompt, {
            model: modelToUse,
            context: tempAgent.getMemory().getContext(),
            tools: shadowTools,
          })).catch((error: unknown) => {
            console.error('[IntegrationAgent] runLoop error:', error);
            leave(tempAgent);
            resolve();
          });

          setTimeout(() => {
            if (!isDone) {
              console.warn('[IntegrationAgent] Repair loop timed out; continuing with deterministic rebuild.');
              leave(tempAgent);
              resolve();
            }
          }, REPAIR_TIMEOUT_MS);
        });

        build = await runInShadowWorkspace(shadowPath, 'npm run build');
      }

      const pluginCtx = { source: plan.profile.source, target: plan.profile.target };
      const catalogEntry = findMigrationCatalogEntry(plan.profile.source, plan.profile.target);
      const structureIssues = collectShadowIssues(shadowPath, pluginCtx, catalogEntry?.layer);
      const buildFailed = !build.ok || !install.ok;
      const verifierFailed = structureIssues.length > 0;

      if (!buildFailed && !verifierFailed) {
        await completeMigration(producerId, planId, 'Shadow build succeeded. Reporter is writing MIGRATION.md next. Then Apply copies the result into your project.', 'info');
        return;
      }

      const implicated = parseImplicatedFiles(
        `${install.ok ? '' : install.output + '\n'}${build.output}`,
        shadowPath,
      );
      const repairFiles = collectRepairTargets(shadowPath, pluginCtx, {
        implicated,
        issues: structureIssues,
        catalog: catalogEntry,
        layer: catalogEntry?.layer,
      });
      const errors = [
        ...structureIssues.flatMap((issue) => issue.errors),
        ...(install.ok ? [] : [`npm install failed:\n${install.output.slice(0, 1500)}`]),
        ...(build.ok ? [] : [`npm run build failed:\n${build.output.slice(0, 2500)}`]),
      ];

      if (!lastRound && repairFiles.length > 0) {
        log(
          producerId,
          planId,
          buildFailed
            ? 'npm run build (or npm install) failed. Assigning repair tasks to Worker — the run is not finished.'
            : `Shadow compile may succeed while the app is still wrong: ${structureIssues.length} verifier issue(s). Assigning repair tasks.`,
          'warning'
        );
        await requeueBrokenFiles(producerId, planId, repairFiles, errors.length > 0 ? errors : ['Shadow verification failed.']);
        return;
      }

      await failMigration(
        producerId,
        planId,
        lastRound
          ? `npm run build still does not pass after ${MAX_INTEGRATION_ROUNDS} integration rounds. The migration is not successful.`
          : 'Shadow verification failed and no repair files could be assigned.',
      );
    } catch (error: unknown) {
      console.error(`[IntegrationAgent] Error:`, error);
      await failMigration(producerId, planId, 'Integration Phase encountered an error. The migration is not successful.');
    } finally {
      resolveRuntime().state.integrationLocks.delete(planId);
    }
  },
};

const manageIntegrationHandler: SituationHandler = {
  specification: new WhenIntegrationStarts(),
  processor: integrationProcessor,
};

export function createIntegrationAgent(tools: Tool[] = []): Agent {
  return createAgent({
    name: 'IntegrationAgent',
    capabilities: ['integration_testing', 'code_repair'],
    instruction: 'You are the Integration Agent. You run npm install and npm run build in the shadow workspace. A passing compile is not enough if catalog verifiers fail. Never mark the migration complete unless the shadow build passes and verifiers are clean. On failure, reopen file tasks for Worker.',
    tools: tools,
    handlers: [manageIntegrationHandler],
  });
}
