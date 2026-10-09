import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigStore } from '@nikelyh/infrastructure';
import {
  isMetamorphConfigKey,
  MetamorphConfigKey,
  MetamorphConfig,
  MOZAIK_BUNDLED_MODELS,
  isMozaikBundledModel,
  validateDisabledAgents,
} from '@nikelyh/domain';
import { promptModelSelection, runInteractiveWizard } from './config.prompts';

export function printConfigList(): void {
  const resolved = ConfigStore.resolveConfig();
  const local = ConfigStore.loadLocalConfig() || {};
  const global = ConfigStore.loadGlobalConfig() || {};
  const env = ConfigStore.loadEnvConfig();

  console.log(chalk.blue(`\n📋 Metamorph Resolved Configuration:`));
  console.log(chalk.gray(`Local file:  ${ConfigStore.getConfigPath(false)} (${Object.keys(local).length > 0 ? chalk.green('found') : chalk.gray('none')})`));
  console.log(chalk.gray(`Global file: ${ConfigStore.getConfigPath(true)} (${Object.keys(global).length > 0 ? chalk.green('found') : chalk.gray('none')})\n`));

  const determineSource = (key: MetamorphConfigKey): string => {
    if (env[key] !== undefined) return chalk.magenta('(env)');
    if (local[key] !== undefined) return chalk.cyan('(local)');
    if (global[key] !== undefined) return chalk.yellow('(global)');
    return chalk.gray('(default)');
  };

  const keys: MetamorphConfigKey[] = [
    'model',
    'reviewerModel',
    'concurrency',
    'inferenceTimeoutMs',
    'maxRetries',
    'maxIntegrationRounds',
    'disabledAgents',
  ];

  for (const k of keys) {
    const val = resolved[k];
    if (val !== undefined) {
      const display = Array.isArray(val) ? (val.length > 0 ? val.join(', ') : 'none') : String(val);
      console.log(`  • ${chalk.white(k)}: ${chalk.green(display)} ${determineSource(k)}`);
    }
  }
  console.log('');
}

async function handleInteractiveSet(): Promise<void> {
  const { select } = await import('@inquirer/prompts');
  const keyToSet = await select<MetamorphConfigKey>({
    message: 'Select the setting to modify:',
    choices: [
      { name: 'model (Primary LLM model)', value: 'model' },
      { name: 'reviewerModel (Specific reviewer model)', value: 'reviewerModel' },
      { name: 'concurrency (Parallel agent workers)', value: 'concurrency' },
      { name: 'inferenceTimeoutMs (Timeout per file)', value: 'inferenceTimeoutMs' },
      { name: 'maxRetries (Maximum repair attempts)', value: 'maxRetries' },
      { name: 'maxIntegrationRounds (Maximum build repair rounds)', value: 'maxIntegrationRounds' },
      { name: 'disabledAgents (Auxiliary agents to disable: reporter, reviewer, accounting)', value: 'disabledAgents' },
    ],
  });

  let finalVal: string | number | string[];
  if (keyToSet === 'model' || keyToSet === 'reviewerModel') {
    finalVal = await promptModelSelection();
  } else if (keyToSet === 'disabledAgents') {
    const { input } = await import('@inquirer/prompts');
    const raw = await input({
      message: 'Enter comma-separated auxiliary agents to disable (reporter, reviewer, accounting) or empty to clear:',
    });
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const validation = validateDisabledAgents(parts);
    if (!validation.valid) {
      console.error(chalk.red(`\n❌ [ConfigError] ${validation.error}`));
      return;
    }
    finalVal = validation.disabled;
  } else {
    const { input } = await import('@inquirer/prompts');
    const raw = await input({
      message: `Enter new value for ${keyToSet}:`,
      validate: (val) => val.trim().length > 0 || 'Value cannot be empty',
    });
    finalVal = parseInt(raw, 10);
    if (Number.isNaN(finalVal)) {
      console.error(chalk.red(`Invalid integer for ${keyToSet}.`));
      return;
    }
  }

  const scope = await select({
    message: 'Save scope:',
    choices: [
      { name: 'Local project (.metamorphrc.json)', value: false },
      { name: 'Global user home (~/.metamorphrc.json)', value: true },
    ],
  });

  if (scope) {
    ConfigStore.saveGlobalConfig({ [keyToSet]: finalVal });
    console.log(chalk.green(`✅ Updated global ${keyToSet} = ${finalVal}`));
  } else {
    ConfigStore.saveLocalConfig({ [keyToSet]: finalVal });
    console.log(chalk.green(`✅ Updated local ${keyToSet} = ${finalVal}`));
  }
}

async function handleTopLevelConfigAction(): Promise<void> {
  try {
    const { select } = await import('@inquirer/prompts');
    const action = await select({
      message: 'What configuration action would you like to perform?',
      choices: [
        { name: '🧙 Run full interactive setup wizard (Initialize / Update)', value: 'init' },
        { name: '📋 List current resolved configuration', value: 'list' },
        { name: '✏️  Change a specific setting (Model, Concurrency, etc.)', value: 'set' },
      ],
    });

    if (action === 'init') {
      const scope = await select({
        message: 'Where do you want to save the configuration?',
        choices: [
          { name: 'Local project (.metamorphrc.json in current directory)', value: false },
          { name: 'Global user home (~/.metamorphrc.json)', value: true },
        ],
      });
      await runInteractiveWizard(scope);
    } else if (action === 'list') {
      printConfigList();
    } else if (action === 'set') {
      await handleInteractiveSet();
    }
  } catch (error: unknown) {
    console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

async function handleSetSubcommand(key: string, rawValue: string | undefined, isGlobal?: boolean): Promise<void> {
  if (!isMetamorphConfigKey(key)) {
    console.error(chalk.red(`Unknown configuration key: "${key}".`));
    console.log(chalk.gray(`Valid keys: model, reviewerModel, concurrency, inferenceTimeoutMs, maxRetries, maxIntegrationRounds, disabledAgents`));
    process.exit(1);
  }

  let parsedValue: unknown = rawValue;
  if (!rawValue && (key === 'model' || key === 'reviewerModel')) {
    parsedValue = await promptModelSelection();
  } else if (!rawValue) {
    const { input } = await import('@inquirer/prompts');
    parsedValue = await input({
      message: `Enter value for ${key}:`,
      validate: (val) => val.trim().length > 0 || 'Value cannot be empty',
    });
  }

  if (key === 'disabledAgents') {
    const rawStr = String(parsedValue ?? '');
    const parts = rawStr.split(',').map((s) => s.trim()).filter(Boolean);
    const validation = validateDisabledAgents(parts);
    if (!validation.valid) {
      console.error(chalk.red(`\n❌ [ConfigError] ${validation.error}`));
      process.exit(1);
    }
    parsedValue = validation.disabled;
  }

  if ((key === 'model' || key === 'reviewerModel') && typeof parsedValue === 'string') {
    if (!isMozaikBundledModel(parsedValue)) {
      console.log(chalk.yellow(`\n⚠️  Warning: "${parsedValue}" is not an officially bundled Mozaik v4 model.`));
      console.log(chalk.gray(`Known models: ${MOZAIK_BUNDLED_MODELS.join(', ')}`));
      const { confirm } = await import('@inquirer/prompts');
      const proceed = await confirm({
        message: 'Do you want to save it anyway as a custom model?',
        default: false,
      });
      if (!proceed) {
        console.log(chalk.gray('Aborted. Configuration was not modified.'));
        return;
      }
    }
  }

  if (['concurrency', 'inferenceTimeoutMs', 'maxRetries', 'maxIntegrationRounds'].includes(key)) {
    const num = typeof parsedValue === 'number' ? parsedValue : parseInt(String(parsedValue), 10);
    if (Number.isNaN(num)) {
      console.error(chalk.red(`Invalid value for ${key}: "${String(parsedValue)}" must be a valid number.`));
      process.exit(1);
    }
    parsedValue = num;
  }

  const update = { [key]: parsedValue } as Partial<MetamorphConfig>;
  if (isGlobal) {
    ConfigStore.saveGlobalConfig(update);
    console.log(chalk.green(`✅ Updated global ${key} = ${String(parsedValue)}`));
  } else {
    ConfigStore.saveLocalConfig(update);
    console.log(chalk.green(`✅ Updated local ${key} = ${String(parsedValue)}`));
  }
}

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage Metamorph project-level or global configuration (.metamorphrc.json)')
    .action(handleTopLevelConfigAction);

  configCmd
    .command('init')
    .description('Interactive setup wizard to initialize or update .metamorphrc.json')
    .option('-g, --global', 'Save configuration globally in user home directory')
    .action(async (options: { global?: boolean }) => {
      try {
        await runInteractiveWizard(!!options.global);
      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Configuration wizard failed: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  configCmd
    .command('get <key>')
    .description('Get the value of a configuration key')
    .action((key: string) => {
      if (!isMetamorphConfigKey(key)) {
        console.error(chalk.red(`Unknown configuration key: "${key}".`));
        console.log(chalk.gray(`Valid keys: model, reviewerModel, concurrency, inferenceTimeoutMs, maxRetries, maxIntegrationRounds`));
        process.exit(1);
      }
      const resolved = ConfigStore.resolveConfig();
      const val = resolved[key as MetamorphConfigKey];
      console.log(`${chalk.cyan(key)}: ${chalk.green(String(val))}`);
    });

  configCmd
    .command('set <key> [value]')
    .description('Set a configuration key in .metamorphrc.json')
    .option('-g, --global', 'Persist in global ~/.metamorphrc.json instead of current project')
    .action(async (key: string, rawValue: string | undefined, options: { global?: boolean }) => {
      await handleSetSubcommand(key, rawValue, options.global);
    });

  configCmd
    .command('list')
    .description('List all resolved configuration settings and file locations')
    .action(() => {
      printConfigList();
    });
}
