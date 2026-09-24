#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import 'dotenv/config';
import * as path from 'node:path';

import {
  SQLiteStateStore,
  createReadFileTool,
  createWriteFileTool,
  createRenameFileTool,
  createCreateFileTool,
  createDeleteFileTool,
  createListDirectoryTool,
  createApiServer,
  MigrationIntegrator,
  ShadowWorkspace,
  detectTechnologies,
  inspectProject,
  detectMonorepo,
  createCheckProjectDiagnosticsTool,
  createRunBuildTool
} from '@nikelyh/infrastructure';
import { MigrationRunner } from '@nikelyh/application';

function logStartupContext() {
  const isDev = process.env.METAMORPH_DEV === '1';
  console.log(chalk.gray(`[Metamorph] CWD: ${process.cwd()}`));
  console.log(chalk.gray(`[Metamorph] Binary: ${import.meta.url}`));
  if (!isDev && import.meta.url.includes('/src/')) {
    console.log(chalk.yellow(`[Metamorph] Notice: Running directly from source without METAMORPH_DEV=1.`));
  }
}

const program = new Command();

program
  .name('metamorph')
  .description('AI-powered technology migration tool using Mozaik Agents')
  .version('2.1.1');

// ─── RUN COMMAND ───────────────────────────────────────────

program
  .command('run [path]')
  .description('Run a migration on the specified directory')
  .option('--from <source>', 'Source framework (e.g. express)')
  .option('--to <target>', 'Target framework (e.g. fastify)')
  .action(async (targetPathArg: string | undefined, options: { from?: string; to?: string }) => {
    logStartupContext();
    let targetPath = targetPathArg || '.';
    const { select, input } = await import('@inquirer/prompts');

    let from = options.from;
    let to = options.to;

    // Supported migrations map
    const SUPPORTED_MIGRATIONS: Record<string, string[]> = {
      express: ['fastify', 'nestjs'],
      fastify: ['express', 'nestjs'],
      nestjs: ['express', 'fastify'],
      react: ['next', 'vue', 'angular', 'svelte'],
      next: ['react', 'vue', 'angular', 'svelte'],
      vue: ['react', 'next', 'angular', 'svelte'],
      angular: ['react', 'next', 'vue', 'svelte'],
      svelte: ['react', 'next', 'vue', 'angular'],
    };

    // Monorepo workspace detection and selection
    const monorepo = detectMonorepo(targetPath);
    if (monorepo.isMonorepo && monorepo.packages.length > 0) {
      console.log(chalk.cyan(`\n📦 Monorepo detected (${monorepo.tool || 'workspaces'} with ${monorepo.packages.length} packages).`));
      const chosenPath = await select({
        message: 'Select the workspace package you want to migrate:',
        choices: [
          ...monorepo.packages.map(p => ({
            name: `${p.name} (${p.relativePath})`,
            value: p.absolutePath,
          })),
          {
            name: `Whole root directory (${targetPath})`,
            value: targetPath,
          }
        ],
      });
      targetPath = chosenPath;
    }

    if (!from) {
      console.log(chalk.gray(`\n🔍 Scanning directory: ${targetPath}`));
      const profiles = inspectProject(targetPath);
      // Filter detected technologies to only those we support migrating FROM
      const supportedProfiles = profiles.filter(p => Object.keys(SUPPORTED_MIGRATIONS).includes(p.framework));

      if (supportedProfiles.length > 0) {
        from = await select({
          message: 'What technology do you want to migrate FROM?',
          choices: supportedProfiles.map(p => {
            const details = [
              p.variant !== 'none' ? p.variant : null,
              p.bundler !== 'unknown' ? p.bundler : null,
              p.language === 'typescript' ? 'TS' : 'JS',
            ].filter(Boolean).join(' | ');

            const label = details ? `${p.framework} (${details} - ${p.confidence}%)` : `${p.framework} (${p.confidence}%)`;
            return { name: label, value: p.framework };
          })
        });
      } else {
        console.log(chalk.yellow(`No supported technologies detected in the current directory.`));
        process.exit(0);
      }
    }

    if (!to) {
      const validTargets = SUPPORTED_MIGRATIONS[from] || [];
      if (validTargets.length > 0) {
        to = await select({
          message: `What framework do you want to migrate TO from ${from}?`,
          choices: validTargets.map(t => ({ name: t, value: t }))
        });
      } else {
        console.log(chalk.red(`No supported target frameworks for ${from}.`));
        process.exit(1);
      }
    }

    console.log(chalk.blue(`\n🚀 Starting Metamorph Migration`));
    console.log(chalk.gray(`Target: ${targetPath} | ${from} -> ${to}\n`));

    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      console.log(chalk.red(`\n❌ ERROR: No LLM API key detected.`));
      console.log(chalk.yellow(`Metamorph requires an API key (OPENAI_API_KEY or ANTHROPIC_API_KEY) to power the AI Worker agents.`));
      console.log(chalk.yellow(`Execution has been blocked to prevent agents from crashing during the migration.\n`));
      console.log(chalk.white(`To fix this, you can either:`));
      console.log(chalk.gray(`  1. Create a `) + chalk.cyan(`.env`) + chalk.gray(` file in your current directory with:`));
      console.log(chalk.green(`     OPENAI_API_KEY=sk-...`));
      console.log(chalk.gray(`  2. Or set it directly in your terminal:`));
      console.log(chalk.gray(`     Linux/macOS: `) + chalk.cyan(`export OPENAI_API_KEY="sk-..."`));
      console.log(chalk.gray(`     Windows: `) + chalk.cyan(`$env:OPENAI_API_KEY="sk-..."\n`));
      process.exit(1);
    }

    const spinner = ora('Initializing...').start();
    try {
      const store = new SQLiteStateStore('.metamorph');
      const shadowBase = path.resolve('.metamorph/shadow');
      const tools = [
        createReadFileTool(shadowBase),
        createWriteFileTool(shadowBase),
        createRenameFileTool(shadowBase),
        createCreateFileTool(shadowBase),
        createDeleteFileTool(shadowBase),
        createListDirectoryTool(shadowBase),
        createCheckProjectDiagnosticsTool(shadowBase),
        createRunBuildTool(shadowBase)
      ];
      const runner = new MigrationRunner(store, tools);

      const result = await runner.startMigration({
        targetPath,
        from: from,
        to: to,
      });

      spinner.succeed(`Migration dispatched! Plan: ${result.planId}`);
      console.log(chalk.gray(`Shadow: ${result.shadowPath}`));
      console.log(chalk.blue(`\n⏳ Swarm is executing migration in shadow workspace...`));

      const waitSpinner = ora('Waiting for swarm to complete migration...').start();
      const startTime = Date.now();
      const MAX_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

      while (true) {
        if (Date.now() - startTime >= MAX_TIMEOUT_MS) {
          waitSpinner.fail(chalk.red(`Migration timed out after 30 minutes.`));
          process.exit(1);
        }

        await new Promise((r) => setTimeout(r, 2000));

        const plan = await store.getPlan(result.planId);
        if (!plan) continue;

        const terminalTasks = plan.tasks.filter((t) => t.status === 'completed' || t.status === 'failed');
        const inProgressTasks = plan.tasks.filter((t) => t.status === 'in_progress');
        const pendingTasks = plan.tasks.filter((t) => t.status === 'pending');

        waitSpinner.text = `Phase: ${plan.phase || 'files'} | Tasks: ${terminalTasks.length}/${plan.tasks.length} terminal (${inProgressTasks.length} in progress, ${pendingTasks.length} pending)`;

        if (plan.outcome === 'success') {
          waitSpinner.succeed(chalk.green(`\n✅ Migration finished successfully in shadow workspace!`));
          console.log(chalk.white(`\nNext steps:`));
          console.log(chalk.gray(`  1. Review changes in shadow workspace: `) + chalk.cyan(result.shadowPath));
          console.log(chalk.gray(`  2. Apply changes to a dedicated Git branch: `) + chalk.cyan(`metamorph apply ${result.runId} ${targetPath}\n`));
          process.exit(0);
        }

        if (plan.phase === 'failed' || plan.outcome === 'failed') {
          waitSpinner.fail(chalk.red(`\n❌ Migration failed in shadow workspace.`));
          console.log(chalk.yellow(`Check .metamorph/shadow/${result.runId}/MIGRATION.md or run 'metamorph ui' for failure details.`));
          console.log(chalk.gray(`Your original codebase in "${targetPath}" remains completely untouched.\n`));
          process.exit(1);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Migration failed: ${errorMessage}`);
      process.exit(1);
    }
  });

// ─── APPLY COMMAND ─────────────────────────────────────────

program
  .command('apply <runId> <targetPath>')
  .description('Apply a completed migration to the target project (requires Git at the project or monorepo root)')
  .action(async (runId: string, targetPath: string) => {
    try {
      const store = new SQLiteStateStore('.metamorph');
      const plans = await store.getAllPlans();
      const plan = plans.find((p) => p.runId === runId);
      if (!plan) {
        throw new Error(`Plan for run "${runId}" not found in database.`);
      }
      if (plan.phase !== 'completed' || plan.outcome !== 'success') {
        throw new Error(
          `Cannot apply migration: plan is not completed successfully (phase: "${plan.phase}", outcome: "${plan.outcome || 'none'}"). Only successful migrations can be applied.`
        );
      }
      if (plan.appliedAt) {
        throw new Error(
          `Migration for run "${runId}" has already been applied at ${new Date(plan.appliedAt).toISOString()} to branch ${plan.appliedBranch || 'unknown'}.`
        );
      }
      const integrator = new MigrationIntegrator(new ShadowWorkspace());
      const result = await integrator.applyMigration(runId, targetPath);
      plan.appliedAt = new Date();
      plan.appliedBranch = result.branch;
      await store.savePlan(plan);
      console.log(chalk.green(`✅ ${result.message}`));
    } catch (error: unknown) {
      console.error(chalk.red(`❌ Failed to apply migration: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// ─── ROLLBACK COMMAND ──────────────────────────────────────

program
  .command('rollback <runId>')
  .description('Rollback and discard an unapplied migration shadow workspace')
  .action(async (runId: string) => {
    try {
      const store = new SQLiteStateStore('.metamorph');
      const runner = new MigrationRunner(store, []);
      await runner.rollbackMigration(runId);
      console.log(chalk.green(`✅ Rolled back run: ${runId}`));
    } catch (error: unknown) {
      console.error(chalk.red(`❌ Failed to rollback: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// ─── RESET COMMAND ─────────────────────────────────────────

program
  .command('reset')
  .description('Clear all migration history and events from the database')
  .action(async () => {
    try {
      const store = new SQLiteStateStore('.metamorph');
      await store.reset();
      console.log(chalk.green(`✅ Migration state reset successfully.`));
    } catch (error: unknown) {
      console.error(chalk.red(`❌ Failed to reset: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// ─── DETECT COMMAND ────────────────────────────────────────

program
  .command('detect [path]')
  .description('Detect frameworks, architectural variants and monorepo structure in a directory')
  .action(async (targetPath: string) => {
    try {
      const resolved = targetPath || '.';
      const monorepo = detectMonorepo(resolved);
      if (monorepo.isMonorepo) {
        console.log(chalk.cyan(`\n📦 Monorepo Detected: ${monorepo.tool || 'workspaces'}`));
        console.log(chalk.gray(`Root: ${monorepo.rootPath}`));
        console.log(chalk.gray(`Workspace Packages (${monorepo.packages.length}):`));
        monorepo.packages.forEach(p => console.log(`  • ${chalk.white(p.name)}: ${chalk.gray(p.relativePath)}`));
      }

      const profiles = inspectProject(resolved);
      if (profiles.length === 0) {
        console.log(chalk.yellow(`\nNo supported technologies detected.`));
      } else {
        console.log(chalk.blue(`\n🔍 Detected Technologies & Architecture:`));
        profiles.forEach(p => {
          console.log(`\n  • ${chalk.bold.green(p.framework)} (Confidence: ${p.confidence}%)`);
          console.log(`    Category: ${chalk.cyan(p.category)} | Variant: ${chalk.cyan(p.variant)} | Bundler: ${chalk.cyan(p.bundler)} | Lang: ${chalk.cyan(p.language.toUpperCase())}`);
          if (p.subsumedDependencies.length > 0) {
            console.log(`    Subsumed Dependencies: ${chalk.yellow(p.subsumedDependencies.join(', '))}`);
          }
          console.log(`    Suggested Targets: ${chalk.magenta(p.suggestedTargets.join(', '))}`);
          console.log(`    Evidence: ${chalk.gray(p.evidence.join('; '))}`);
        });
        console.log('');
      }
    } catch (error: unknown) {
      console.error(chalk.red(`❌ Detection failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// ─── LIST COMMAND ──────────────────────────────────────────

program
  .command('list')
  .description('List past migration plans')
  .action(async () => {
    try {
      const store = new SQLiteStateStore('.metamorph');
      const plans = await store.getAllPlans();
      if (plans.length === 0) {
        console.log(chalk.yellow(`No migration plans found.`));
        return;
      }
      console.log(chalk.blue(`\n📋 Migration Plans:`));
      plans.forEach(p => {
        console.log(`${chalk.green(p.id)} | ${p.profile.source} -> ${p.profile.target} | Target: ${p.targetPath} | Tasks: ${p.tasks.length}`);
      });
    } catch (error: unknown) {
      console.error(chalk.red(`❌ Failed to list plans: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// ─── UI COMMAND ────────────────────────────────────────────

program
  .command('ui')
  .description('Start the Metamorph Dashboard API server')
  .option('-p, --port <number>', 'Port for the API server', '9876')
  .action(async (options) => {
    logStartupContext();
    let desiredPort = parseInt(options.port, 10);
    const spinner = ora('Starting Metamorph API server...').start();
    try {
      const getPort = (await import('get-port')).default;
      const open = (await import('open')).default;
      
      const port = await getPort({ port: desiredPort });

      if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        console.log(chalk.red(`\n❌ ERROR: No LLM API key detected.`));
        console.log(chalk.yellow(`Metamorph requires an API key (OPENAI_API_KEY or ANTHROPIC_API_KEY) to power the AI Worker agents.`));
        console.log(chalk.yellow(`Execution has been blocked to prevent agents from crashing during the migration.\n`));
        console.log(chalk.white(`To fix this, you can either:`));
        console.log(chalk.gray(`  1. Create a `) + chalk.cyan(`.env`) + chalk.gray(` file in your current directory with:`));
        console.log(chalk.green(`     OPENAI_API_KEY=sk-...`));
        console.log(chalk.gray(`  2. Or set it directly in your terminal:`));
        console.log(chalk.gray(`     Linux/macOS: `) + chalk.cyan(`export OPENAI_API_KEY="sk-..."`));
        console.log(chalk.gray(`     Windows: `) + chalk.cyan(`$env:OPENAI_API_KEY="sk-..."\n`));
        process.exit(1);
      }
      
      const store = new SQLiteStateStore('.metamorph');
      const shadowBase = path.resolve('.metamorph/shadow');
      const tools = [
        createReadFileTool(shadowBase),
        createWriteFileTool(shadowBase),
        createRenameFileTool(shadowBase),
        createCreateFileTool(shadowBase),
        createDeleteFileTool(shadowBase),
        createListDirectoryTool(shadowBase),
        createCheckProjectDiagnosticsTool(shadowBase),
        createRunBuildTool(shadowBase)
      ];
      const runner = new MigrationRunner(store, tools);

      const app = await createApiServer(store, runner);

      app.listen(port, () => {
        spinner.succeed(
          `Metamorph UI running on http://localhost:${port}`
        );
        console.log(chalk.blue(`\nEndpoints available:`));
        console.log(chalk.gray(`  GET  /api/plans`));
        console.log(chalk.gray(`  GET  /api/events`));
        console.log(chalk.gray(`  POST /api/migrations/start`));
        console.log(chalk.gray(`  POST /api/migrations/rollback`));
        
        // Auto open browser
        open(`http://localhost:${port}`);
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed to start: ${errorMessage}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
