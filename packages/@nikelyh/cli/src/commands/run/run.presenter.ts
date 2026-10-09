import { isMozaikBundledModel, MetamorphConfig, MigrationCostSummary, MOZAIK_BUNDLED_MODELS } from '@nikelyh/domain';
import chalk from 'chalk';

export function logStartupContext(): void {
  const isDev = process.env.METAMORPH_DEV === '1';
  console.log(chalk.gray(`[Metamorph] CWD: ${process.cwd()}`));
  console.log(chalk.gray(`[Metamorph] Binary: ${import.meta.url}`));
  if (!isDev && import.meta.url.includes('/src/')) {
    console.log(chalk.yellow(`[Metamorph] Notice: Running directly from source without METAMORPH_DEV=1.`));
  }
}

export function presentMissingApiKey(): void {
  console.log(chalk.red(`\n❌ ERROR: No LLM API key detected.`));
  console.log(chalk.yellow(`Metamorph requires an API key (OPENAI_API_KEY or ANTHROPIC_API_KEY) to power the AI Worker agents.`));
  console.log(chalk.yellow(`Execution has been blocked to prevent agents from crashing during the migration.\n`));
  console.log(chalk.white(`To fix this, you can either:`));
  console.log(chalk.gray(`  1. Create a `) + chalk.cyan(`.env`) + chalk.gray(` file in your current directory with:`));
  console.log(chalk.green(`     OPENAI_API_KEY=sk-...`));
  console.log(chalk.gray(`  2. Or set it directly in your terminal:`));
  console.log(chalk.gray(`     Linux/macOS: `) + chalk.cyan(`export OPENAI_API_KEY="sk-..."`));
  console.log(chalk.gray(`     Windows: `) + chalk.cyan(`$env:OPENAI_API_KEY="sk-..."\n`));
}

export function presentModelWarning(model?: string): void {
  if (model && !isMozaikBundledModel(model)) {
    console.log(chalk.yellow(`\n⚠️  Notice: "${model}" is not an officially bundled Mozaik v4 model.`));
    console.log(chalk.gray(`Officially bundled models: ${MOZAIK_BUNDLED_MODELS.join(', ')}\n`));
  }
}

export function presentMigrationStart(params: {
  targetPath: string;
  from: string;
  to: string;
  config: MetamorphConfig;
}): void {
  const { targetPath, from, to, config } = params;
  console.log(chalk.blue(`\n🚀 Starting Metamorph Migration`));
  console.log(chalk.gray(`Target: ${targetPath} | ${from} -> ${to}`));
  console.log(
    chalk.gray(
      `Model: ${config.model} | Concurrency: ${config.concurrency} | Timeout: ${config.inferenceTimeoutMs / 1000}s | Retries: ${config.maxRetries}`
    )
  );
  if (config.disabledAgents && config.disabledAgents.length > 0) {
    console.log(chalk.yellow(`⚡ Disabled Agents: ${config.disabledAgents.join(', ')} (token-saving mode enabled)`));
  }
  console.log('');
}

export function presentMigrationSuccess(result: { shadowPath: string; runId: string }, targetPath: string): void {
  console.log(chalk.green(`\n✅ Migration finished successfully in shadow workspace!`));
  console.log(chalk.white(`\nNext steps:`));
  console.log(chalk.gray(`  1. Review changes in shadow workspace: `) + chalk.cyan(result.shadowPath));
  console.log(
    chalk.gray(`  2. Apply changes to a dedicated Git branch: `) +
      chalk.cyan(`metamorph apply ${result.runId} ${targetPath}\n`)
  );
}

export function presentMigrationFailure(runId: string, targetPath: string): void {
  console.log(chalk.red(`\n❌ Migration failed in shadow workspace.`));
  console.log(chalk.yellow(`Check .metamorph/shadow/${runId}/MIGRATION.md or run 'metamorph ui' for failure details.`));
  console.log(chalk.gray(`Your original codebase in "${targetPath}" remains completely untouched.\n`));
}

export function presentCostSummary(summary: MigrationCostSummary): void {
  if (!summary || summary.totalTokens === 0) return;

  console.log(chalk.cyan(`\n────────────────────────────────────────────────────────────`));
  console.log(chalk.bold.white(`📊 LLM Token Consumption & Cost Estimation`));
  console.log(chalk.cyan(`────────────────────────────────────────────────────────────`));
  console.log(
    chalk.white(`Total Tokens:     `) +
      chalk.green(summary.totalTokens.toLocaleString()) +
      chalk.gray(` (Prompt: ${summary.promptTokens.toLocaleString()} | Completion: ${summary.completionTokens.toLocaleString()})`)
  );
  console.log(
    chalk.white(`Estimated Cost:   `) +
      chalk.yellow(`$${summary.totalCostUsd.toFixed(4)} USD`)
  );

  const roles = Object.entries(summary.byAgentRole).filter(([_, data]) => data.tokens > 0);
  if (roles.length > 0) {
    console.log(chalk.gray(`\nBreakdown by Agent Role:`));
    for (const [role, data] of roles) {
      console.log(
        chalk.gray(`  • `) +
          chalk.cyan(role.padEnd(12)) +
          chalk.white(`${data.tokens.toLocaleString().padStart(8)} tokens `) +
          chalk.yellow(`($${data.costUsd.toFixed(4)} USD)`) +
          chalk.gray(` [${data.executions} executions]`)
      );
    }
  }

  const models = Object.entries(summary.byModel).filter(([_, data]) => data.totalTokens > 0);
  if (models.length > 1) {
    console.log(chalk.gray(`\nBreakdown by Model:`));
    for (const [model, data] of models) {
      console.log(
        chalk.gray(`  • `) +
          chalk.white(model.padEnd(20)) +
          chalk.green(`${data.totalTokens.toLocaleString().padStart(8)} tokens `) +
          chalk.yellow(`($${data.costUsd.toFixed(4)} USD)`)
      );
    }
  }
  console.log(chalk.cyan(`────────────────────────────────────────────────────────────\n`));
}
