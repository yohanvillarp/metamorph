#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import 'dotenv/config';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

import { SQLiteStateStore, createReadFileTool, createWriteFileTool } from '@nikelyh/infrastructure';
import { bootstrapMetamorph, sendEvent, join } from '@nikelyh/application';
import { SemanticEventName, SemanticEventPayloads, MigrationPlan } from '@nikelyh/domain';
import { ShadowWorkspace } from './utils/ShadowWorkspace';

const program = new Command();

program
  .name('metamorph')
  .description('AI-powered technology migration tool using Mozaik Agents')
  .version('1.0.0');

program
  .command('run <path>')
  .description('Run a migration on the specified directory')
  .requiredOption('--from <source>', 'Source framework (e.g. express)')
  .requiredOption('--to <target>', 'Target framework (e.g. fastify)')
  .action(async (targetPath: string, options: { from: string; to: string }) => {
    console.log(chalk.blue(`\n🚀 Starting Metamorph Migration`));
    console.log(chalk.gray(`Target: ${targetPath} | ${options.from} -> ${options.to}\n`));

    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      console.log(chalk.yellow(`⚠️ WARNING: No LLM API key detected in env. Inference will fail.\n`));
    }

    const spinner = ora('Initializing Shadow Workspace...').start();
    try {
      const workspace = new ShadowWorkspace();
      const runId = `run_${Date.now()}`;
      
      const shadowPath = workspace.cloneDirectory(targetPath, runId);
      spinner.succeed(`Shadow Workspace created at: ${shadowPath}`);

      spinner.start('Initializing Database and Event Bus...');
      const store = new SQLiteStateStore('.metamorph');
      
      const planId = `plan_${randomUUID()}`;
      const plan: MigrationPlan = {
        id: planId,
        profile: { source: options.from, target: options.to },
        tasks: [{ filePath: shadowPath, status: 'pending' }], // Note: Mapper will expand this later
        createdAt: new Date(),
      };
      await store.savePlan(plan);

      const tools = [createReadFileTool(), createWriteFileTool()];
      bootstrapMetamorph(store, tools);

      const { createHuman } = await import('@mozaik-ai/core');
      const human = createHuman({ name: 'System', capabilities: [], handlers: [] });
      join(human);

      spinner.succeed('Infrastructure ready.');

      console.log(chalk.green(`\n📡 Dispatching Migration Event to the swarm...`));
      sendEvent(
        {
          type: SemanticEventName.MIGRATION_STARTED,
          producerId: human.getId(),
          occurredAt: new Date(),
          payload: {
            planId: planId,
            profile: plan.profile,
            shadowWorkspacePath: shadowPath,
          } as SemanticEventPayloads.MigrationStarted,
        },
        human.getId()
      );

      console.log(chalk.blue(`\n⏳ Agents are now working in the background...`));
      console.log(chalk.gray(`(Waiting for 20 seconds for agents to complete the migration)`));

      await new Promise((resolve) => setTimeout(resolve, 20000));
      console.log(chalk.green(`\n✅ Migration simulation finished.`));
      process.exit(0);

    } catch (error: any) {
      spinner.fail(`Migration failed to start: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('config set <keyValue>')
  .description('Set a configuration value (e.g., OPENAI_API_KEY=sk-...)')
  .action((keyValue: string) => {
    const [key, value] = keyValue.split('=');
    if (!key || !value) {
      console.log(chalk.red('Invalid format. Use KEY=VALUE'));
      return;
    }
    // In a real implementation, this would write to ~/.metamorph/config.json
    console.log(chalk.green(`✓ Config ${key} saved successfully (Simulation)`));
  });

program.parse(process.argv);
