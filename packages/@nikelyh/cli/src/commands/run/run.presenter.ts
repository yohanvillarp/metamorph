import { isMozaikBundledModel, MetamorphConfig, MigrationCostSummary, MOZAIK_BUNDLED_MODELS, ResolvedMigrationCatalog, ProjectProfile } from '@nikelyh/domain';
import chalk from 'chalk';

export function logStartupContext(): void {
  const isDev = process.env.METAMORPH_DEV === '1';
  console.log(chalk.gray(`[Metamorph] CWD: ${process.cwd()}`));
  console.log(chalk.gray(`[Metamorph] Binary: ${import.meta.url}`));
  if (!isDev && import.meta.url.includes('/src/')) {
    console.log(chalk.yellow(`[Metamorph] Notice: Running directly from source without METAMORPH_DEV=1.`));
  }
}

export function hasLlmCredentials(config?: MetamorphConfig): boolean {
  if (
    config?.model === 'mock' ||
    config?.mock ||
    process.env.METAMORPH_MOCK === '1' ||
    process.env.METAMORPH_MOCK === 'true'
  ) {
    return true;
  }
  return !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function presentMockNotice(): void {
  console.log(chalk.cyan(`[Metamorph] Running in Mock/Offline mode: Zero API keys required, zero LLM tokens billed.`));
}

export function presentMissingApiKey(): void {
  console.log(chalk.red(`\n❌ ERROR: No LLM API key detected.`));
  console.log(chalk.yellow(`Metamorph requires an LLM credential (OPENAI_API_KEY, ANTHROPIC_API_KEY, or ANTHROPIC_AUTH_TOKEN) to power the AI Worker agents.`));
  console.log(chalk.yellow(`Execution has been blocked to prevent agents from crashing during the migration.\n`));
  console.log(chalk.white(`To fix this, you can either:`));
  console.log(chalk.gray(`  1. Create a `) + chalk.cyan(`.env`) + chalk.gray(` file in your current directory with:`));
  console.log(chalk.green(`     OPENAI_API_KEY=sk-...`));
  console.log(chalk.green(`     ANTHROPIC_API_KEY=sk-ant-...`));
  console.log(chalk.green(`     ANTHROPIC_AUTH_TOKEN=sk-ant-oat01-...`) + chalk.gray(`  (OAuth token from Claude Max)`));
  console.log(chalk.gray(`  2. Or set it directly in your terminal:`));
  console.log(chalk.gray(`     Linux/macOS: `) + chalk.cyan(`export ANTHROPIC_API_KEY="sk-ant-..."`));
  console.log(chalk.gray(`     Windows: `) + chalk.cyan(`$env:ANTHROPIC_API_KEY="sk-ant-..."\n`));
  console.log(chalk.white(`Or test Metamorph completely offline without credentials using:`));
  console.log(chalk.cyan(`  metamorph run <path> --from <source> --to <target> --model mock\n`));
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

  const headerTitle = summary.isMock
    ? `📊 Simulated Token Consumption (Mock Provider — Offline / Zero Cost)`
    : `📊 LLM Token Consumption & Cost Estimation`;

  console.log(chalk.cyan(`\n────────────────────────────────────────────────────────────`));
  console.log(chalk.bold.white(headerTitle));
  console.log(chalk.cyan(`────────────────────────────────────────────────────────────`));
  console.log(
    chalk.white(`Total Tokens:     `) +
      chalk.green(summary.totalTokens.toLocaleString()) +
      chalk.gray(` (Prompt: ${summary.promptTokens.toLocaleString()} | Completion: ${summary.completionTokens.toLocaleString()})`)
  );
  console.log(
    chalk.white(`Estimated Cost:   `) +
      (summary.isMock
        ? chalk.green(`$0.0000 USD (Mock - Not Billed)`)
        : chalk.yellow(`$${summary.totalCostUsd.toFixed(4)} USD`))
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

export function presentDryRun(params: {
  targetPath: string;
  from: string;
  to: string;
  profile: ProjectProfile;
  catalog: ResolvedMigrationCatalog;
}): void {
  const { targetPath, from, to, profile, catalog } = params;
  const divider = chalk.cyan(`────────────────────────────────────────────────────────────`);

  console.log(divider);
  console.log(chalk.bold.white(`Metamorph Dry Run — ${from} -> ${to}`));
  console.log(divider);

  console.log(chalk.white(`\nDetection`));
  console.log(chalk.gray(`  Path:        `) + chalk.cyan(targetPath));
  console.log(chalk.gray(`  Framework:   `) + chalk.white(profile.framework));
  console.log(chalk.gray(`  Category:    `) + chalk.white(profile.category));
  console.log(chalk.gray(`  Confidence:  `) + chalk.white(`${profile.confidence}%`));
  if (profile.variant !== 'none') {
    console.log(chalk.gray(`  Variant:     `) + chalk.white(profile.variant));
  }
  console.log(chalk.gray(`  Language:    `) + chalk.white(profile.language));
  console.log(chalk.gray(`  Bundler:     `) + chalk.white(profile.bundler));

  console.log(chalk.white(`\nCatalog: ${catalog.description}`));

  if (catalog.dependenciesToRemove && catalog.dependenciesToRemove.length > 0) {
    console.log(chalk.white(`\nDependencies to remove`));
    for (const dep of catalog.dependenciesToRemove) {
      console.log(chalk.red(`  - ${dep}`));
    }
  }
  if (catalog.dependenciesToAdd && Object.keys(catalog.dependenciesToAdd).length > 0) {
    console.log(chalk.white(`\nDependencies to add`));
    for (const [dep, version] of Object.entries(catalog.dependenciesToAdd)) {
      console.log(chalk.green(`  + ${dep}@${version}`));
    }
  }
  if (catalog.devDependenciesToRemove && catalog.devDependenciesToRemove.length > 0) {
    console.log(chalk.white(`\nDev dependencies to remove`));
    for (const dep of catalog.devDependenciesToRemove) {
      console.log(chalk.red(`  - ${dep}`));
    }
  }
  if (catalog.devDependenciesToAdd && Object.keys(catalog.devDependenciesToAdd).length > 0) {
    console.log(chalk.white(`\nDev dependencies to add`));
    for (const [dep, version] of Object.entries(catalog.devDependenciesToAdd)) {
      console.log(chalk.green(`  + ${dep}@${version}`));
    }
  }
  if (catalog.scriptsToUpdate && Object.keys(catalog.scriptsToUpdate).length > 0) {
    console.log(chalk.white(`\nScripts to update`));
    for (const [name, cmd] of Object.entries(catalog.scriptsToUpdate)) {
      console.log(chalk.yellow(`  ${name}: ${cmd}`));
    }
  }
  if (catalog.filesToDelete && catalog.filesToDelete.length > 0) {
    console.log(chalk.white(`\nFiles to delete`));
    for (const f of catalog.filesToDelete) {
      console.log(chalk.red(`  - ${f}`));
    }
  }

  console.log(chalk.white(`\nRule sections (${catalog.ruleSections.length})`));
  for (const section of catalog.ruleSections) {
    const ruleCount = section.groups
      ? section.groups.reduce((n, g) => n + g.rules.length, 0)
      : section.rules.length;
    console.log(chalk.gray(`  [${section.scope}] `) + chalk.white(section.label) + chalk.gray(` (${ruleCount} rules)`));
  }

  console.log(chalk.white(`\nTotal architectural rules: `) + chalk.cyan(`${catalog.architecturalRules.length}`));
  console.log(divider);
  console.log(chalk.green(`\nDry run complete. No files were modified and no LLM tokens were consumed.`));
  console.log(chalk.gray(`Remove --dry-run to execute this migration.\n`));
}
