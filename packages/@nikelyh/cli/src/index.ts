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
} from '@nikelyh/infrastructure';
import { MigrationRunner } from '@nikelyh/application';

const program = new Command();

program
  .name('metamorph')
  .description('AI-powered technology migration tool using Mozaik Agents')
  .version('1.0.0');

// ─── RUN COMMAND ───────────────────────────────────────────

program
  .command('run <path>')
  .description('Run a migration on the specified directory')
  .requiredOption('--from <source>', 'Source framework (e.g. express)')
  .requiredOption('--to <target>', 'Target framework (e.g. fastify)')
  .action(async (targetPath: string, options: { from: string; to: string }) => {
    console.log(chalk.blue(`\n🚀 Starting Metamorph Migration`));
    console.log(chalk.gray(`Target: ${targetPath} | ${options.from} -> ${options.to}\n`));

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
        from: options.from,
        to: options.to,
      });

      spinner.succeed(`Migration dispatched! Plan: ${result.planId}`);
      console.log(chalk.gray(`Shadow: ${result.shadowPath}`));
      console.log(chalk.blue(`\n⏳ Agents are now working...`));

      await new Promise((resolve) => setTimeout(resolve, 20000));
      console.log(chalk.green(`\n✅ Migration simulation finished.`));
      process.exit(0);
    } catch (error: any) {
      spinner.fail(`Migration failed: ${error.message}`);
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
    } catch (error: any) {
      spinner.fail(`Failed to start: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
