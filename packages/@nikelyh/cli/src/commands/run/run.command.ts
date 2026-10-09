import { Command } from 'commander';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import * as path from 'node:path';
import {
  SQLiteStateStore,
  createReadFileTool,
  createWriteFileTool,
  createRenameFileTool,
  createCreateFileTool,
  createDeleteFileTool,
  createListDirectoryTool,
  createCheckProjectDiagnosticsTool,
  createRunBuildTool,
  detectMonorepo,
  inspectProject,
  ConfigStore,
} from '@nikelyh/infrastructure';
import { MigrationRunner } from '@nikelyh/application';
import { MetamorphConfig, MigrationPlan, validateDisabledAgents } from '@nikelyh/domain';
import {
  RunCommandOptions,
  SUPPORTED_MIGRATIONS,
  configureRunOptions,
} from './run.options';
import {
  logStartupContext,
  presentMissingApiKey,
  presentModelWarning,
  presentMigrationStart,
  presentMigrationSuccess,
  presentMigrationFailure,
  presentCostSummary,
} from './run.presenter';

async function resolveTargetDirectory(targetPathArg?: string): Promise<string> {
  const targetPath = targetPathArg || '.';
  const monorepo = detectMonorepo(targetPath);
  if (!monorepo.isMonorepo || monorepo.packages.length === 0) {
    return targetPath;
  }

  const { select } = await import('@inquirer/prompts');
  console.log(chalk.cyan(`\n📦 Monorepo detected (${monorepo.tool || 'workspaces'} with ${monorepo.packages.length} packages).`));
  return await select({
    message: 'Select the workspace package you want to migrate:',
    choices: [
      ...monorepo.packages.map((p) => ({
        name: `${p.name} (${p.relativePath})`,
        value: p.absolutePath,
      })),
      {
        name: `Whole root directory (${targetPath})`,
        value: targetPath,
      },
    ],
  });
}

async function resolveSourceFramework(targetPath: string, fromArg?: string): Promise<string> {
  if (fromArg) return fromArg;
  const { select } = await import('@inquirer/prompts');
  console.log(chalk.gray(`\n🔍 Scanning directory: ${targetPath}`));
  const profiles = inspectProject(targetPath);
  const supportedProfiles = profiles.filter((p) => Object.keys(SUPPORTED_MIGRATIONS).includes(p.framework));

  if (supportedProfiles.length === 0) {
    console.log(chalk.yellow(`No supported technologies detected in the current directory.`));
    process.exit(0);
  }

  return await select({
    message: 'What technology do you want to migrate FROM?',
    choices: supportedProfiles.map((p) => {
      const details = [
        p.variant !== 'none' ? p.variant : null,
        p.bundler !== 'unknown' ? p.bundler : null,
        p.language === 'typescript' ? 'TS' : 'JS',
      ].filter(Boolean).join(' | ');
      const label = details ? `${p.framework} (${details} - ${p.confidence}%)` : `${p.framework} (${p.confidence}%)`;
      return { name: label, value: p.framework };
    }),
  });
}

async function resolveTargetFramework(from: string, toArg?: string): Promise<string> {
  if (toArg) return toArg;
  const { select } = await import('@inquirer/prompts');
  const validTargets = SUPPORTED_MIGRATIONS[from] || [];
  if (validTargets.length === 0) {
    console.log(chalk.red(`No supported target frameworks for ${from}.`));
    process.exit(1);
  }

  return await select({
    message: `What framework do you want to migrate TO from ${from}?`,
    choices: validTargets.map((t) => ({ name: t, value: t })),
  });
}

function parseCliFlags(options: RunCommandOptions): Partial<MetamorphConfig> {
  const cliFlags: Partial<MetamorphConfig> = {};
  if (options.model) cliFlags.model = options.model;
  if (options.reviewerModel) cliFlags.reviewerModel = options.reviewerModel;
  if (options.concurrency) cliFlags.concurrency = parseInt(options.concurrency, 10);
  if (options.timeout) cliFlags.inferenceTimeoutMs = parseInt(options.timeout, 10) * 1000;
  if (options.retries) cliFlags.maxRetries = parseInt(options.retries, 10);
  if (options.integrationRounds) cliFlags.maxIntegrationRounds = parseInt(options.integrationRounds, 10);
  if (options.disableAgents) {
    const rawList = options.disableAgents.split(',').map((s) => s.trim());
    const validation = validateDisabledAgents(rawList);
    if (!validation.valid) {
      console.error(chalk.red(`\n❌ [ConfigError] ${validation.error}`));
      process.exit(1);
    }
    cliFlags.disabledAgents = validation.disabled;
  }
  return cliFlags;
}

function createShadowTools(shadowBase: string) {
  return [
    createReadFileTool(shadowBase),
    createWriteFileTool(shadowBase),
    createRenameFileTool(shadowBase),
    createCreateFileTool(shadowBase),
    createDeleteFileTool(shadowBase),
    createListDirectoryTool(shadowBase),
    createCheckProjectDiagnosticsTool(shadowBase),
    createRunBuildTool(shadowBase),
  ];
}

async function pollMigrationLoop(
  store: SQLiteStateStore,
  result: { planId: string; shadowPath: string; runId: string },
  targetPath: string,
  waitSpinner: Ora
): Promise<void> {
  const startTime = Date.now();
  const MAX_TIMEOUT_MS = 30 * 60 * 1000;

  while (true) {
    if (Date.now() - startTime >= MAX_TIMEOUT_MS) {
      waitSpinner.fail(chalk.red(`Migration timed out after 30 minutes.`));
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, 2000));
    const plan = await store.getPlan(result.planId);
    if (!plan) continue;

    const terminal = plan.tasks.filter((t) => t.status === 'completed' || t.status === 'failed');
    const inProgress = plan.tasks.filter((t) => t.status === 'in_progress');
    const pending = plan.tasks.filter((t) => t.status === 'pending');
    waitSpinner.text = `Phase: ${plan.phase || 'files'} | Tasks: ${terminal.length}/${plan.tasks.length} terminal (${inProgress.length} in progress, ${pending.length} pending)`;

    if (plan.outcome === 'success') {
      waitSpinner.succeed();
      try {
        const costSummary = await store.getCostSummary(result.runId);
        presentCostSummary(costSummary);
      } catch {}
      presentMigrationSuccess(result, targetPath);
      process.exit(0);
    }

    if (plan.phase === 'failed' || plan.outcome === 'failed') {
      waitSpinner.fail();
      try {
        const costSummary = await store.getCostSummary(result.runId);
        presentCostSummary(costSummary);
      } catch {}
      presentMigrationFailure(result.runId, targetPath);
      process.exit(1);
    }
  }
}

export async function executeRunAction(targetPathArg: string | undefined, options: RunCommandOptions): Promise<void> {
  logStartupContext();
  const targetPath = await resolveTargetDirectory(targetPathArg);
  const from = await resolveSourceFramework(targetPath, options.from);
  const to = await resolveTargetFramework(from, options.to);

  const cliFlags = parseCliFlags(options);
  const resolvedConfig = ConfigStore.resolveConfig({ cwd: targetPath, cliFlags });
  presentModelWarning(options.model);
  presentMigrationStart({ targetPath, from, to, config: resolvedConfig });

  const hasApiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasApiKey) {
    presentMissingApiKey();
    process.exit(1);
  }

  const spinner = ora('Initializing...').start();
  try {
    const store = new SQLiteStateStore('.metamorph');
    const shadowBase = path.resolve('.metamorph/shadow');
    const tools = createShadowTools(shadowBase);
    const runner = new MigrationRunner(store, tools, resolvedConfig);

    const result = await runner.startMigration({ targetPath, from, to });
    spinner.succeed(`Migration dispatched! Plan: ${result.planId}`);
    console.log(chalk.gray(`Shadow: ${result.shadowPath}`));
    console.log(chalk.blue(`\n⏳ Swarm is executing migration in shadow workspace...`));

    const waitSpinner = ora('Waiting for swarm to complete migration...').start();
    await pollMigrationLoop(store, result, targetPath, waitSpinner);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    spinner.fail(`Migration failed: ${errorMessage}`);
    process.exit(1);
  }
}

export function registerRunCommand(program: Command): void {
  const cmd = program.command('run [path]');
  configureRunOptions(cmd);
  cmd.action(executeRunAction);
}
