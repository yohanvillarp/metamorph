#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import 'dotenv/config';

import {
  SQLiteStateStore,
  createReadFileTool,
  createWriteFileTool,
  createRenameFileTool,
  createCreateFileTool,
  createDeleteFileTool,
  createApiServer,
  MigrationIntegrator,
  ShadowWorkspace,
  detectTechnologies
} from '@nikelyh/infrastructure';
import { MigrationRunner } from '@nikelyh/application';

const program = new Command();

program
  .name('metamorph')
  .description('AI-powered technology migration tool using Mozaik Agents')
  .version('1.0.0');

// ─── RUN COMMAND ───────────────────────────────────────────

program
  .command('run [path]')
  .description('Run a migration on the specified directory')
  .option('--from <source>', 'Source framework (e.g. express)')
  .option('--to <target>', 'Target framework (e.g. fastify)')
  .action(async (targetPathArg: string | undefined, options: { from?: string; to?: string }) => {
    let targetPath = targetPathArg || '.';
    const { select, input } = await import('@inquirer/prompts');

    let from = options.from;
    let to = options.to;

    // Supported migrations map
    const SUPPORTED_MIGRATIONS: Record<string, string[]> = {
      express: ['fastify', 'nestjs'],
      fastify: ['nestjs', 'express'],
      react: ['next'],
      vue: ['react', 'next'],
      angular: ['react', 'next'],
      svelte: ['react', 'next'],
    };

    if (!from) {
      console.log(chalk.gray(`\n🔍 Scanning directory: ${targetPath}`));
      const detected = detectTechnologies(targetPath);
      // Filter detected technologies to only those we support migrating FROM
      const supportedDetected = detected.filter(d => Object.keys(SUPPORTED_MIGRATIONS).includes(d.framework));

      if (supportedDetected.length > 0) {
        from = await select({
          message: 'What technology do you want to migrate FROM?',
          choices: supportedDetected.map(d => ({ name: `${d.framework} (Detected ${d.confidence}%)`, value: d.framework }))
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
      console.log(chalk.yellow(`⚠️ WARNING: No LLM API key detected.\n`));
    }

    const spinner = ora('Initializing...').start();
    try {
      const store = new SQLiteStateStore('.metamorph');
      const tools = [
        createReadFileTool(),
        createWriteFileTool(),
        createRenameFileTool(),
        createCreateFileTool(),
        createDeleteFileTool()
      ];
      const runner = new MigrationRunner(store, tools);

      const result = await runner.startMigration({
        targetPath,
        from: from,
        to: to,
      });

      spinner.succeed(`Migration dispatched! Plan: ${result.planId}`);
      console.log(chalk.gray(`Shadow: ${result.shadowPath}`));
      console.log(chalk.blue(`\n⏳ Agents are now working...`));

      await new Promise((resolve) => setTimeout(resolve, 20000));
      console.log(chalk.green(`\n✅ Migration simulation finished.`));
      process.exit(0);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Migration failed: ${errorMessage}`);
      process.exit(1);
    }
  });

// ─── APPLY COMMAND ─────────────────────────────────────────

program
  .command('apply <runId> <targetPath>')
  .description('Apply a completed migration to the target project')
  .action(async (runId: string, targetPath: string) => {
    try {
      const integrator = new MigrationIntegrator(new ShadowWorkspace());
      const message = await integrator.applyMigration(runId, targetPath);
      console.log(chalk.green(`✅ ${message}`));
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
  .description('Detect frameworks and libraries in a directory')
  .action(async (targetPath: string) => {
    try {
      const detected = detectTechnologies(targetPath || '.');
      if (detected.length === 0) {
        console.log(chalk.yellow(`No known technologies detected.`));
      } else {
        console.log(chalk.blue(`\n🔍 Detected Technologies:`));
        detected.forEach(d => console.log(` - ${chalk.green(d.framework)} (Confidence: ${d.confidence}%) \n    Evidence: ${chalk.gray(d.evidence.join(', '))}`));
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
    let desiredPort = parseInt(options.port, 10);
    const spinner = ora('Starting Metamorph API server...').start();
    try {
      const getPort = (await import('get-port')).default;
      const open = (await import('open')).default;
      
      const port = await getPort({ port: desiredPort });
      
      const store = new SQLiteStateStore('.metamorph');
      const tools = [
        createReadFileTool(),
        createWriteFileTool(),
        createRenameFileTool(),
        createCreateFileTool(),
        createDeleteFileTool()
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
