import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigStore, CONFIG_FILE_NAME } from '@nikelyh/infrastructure';
import {
  isMetamorphConfigKey,
  MetamorphConfigKey,
  MetamorphConfig,
  DEFAULT_METAMORPH_CONFIG,
  MOZAIK_BUNDLED_MODELS,
  isMozaikBundledModel,
} from '@nikelyh/domain';

/**
 * Interactive model picker displaying officially supported Mozaik v4 bundled models.
 */
async function promptModelSelection(currentValue?: string): Promise<string> {
  const { select, input } = await import('@inquirer/prompts');

  const defaultChoice = currentValue && isMozaikBundledModel(currentValue)
    ? currentValue
    : DEFAULT_METAMORPH_CONFIG.model;

  const choices: { name: string; value: string }[] = [
    // OpenAI (Production Tested)
    { name: 'OpenAI: gpt-5.4 (Recommended default - Stable)', value: 'gpt-5.4' },
    { name: 'OpenAI: gpt-5.4-mini (Fast & efficient)', value: 'gpt-5.4-mini' },
    { name: 'OpenAI: gpt-5.4-nano (Ultra lightweight)', value: 'gpt-5.4-nano' },
    { name: 'OpenAI: gpt-5.5 (High capability reasoning)', value: 'gpt-5.5' },
    // Anthropic (Production Tested)
    { name: 'Anthropic: claude-sonnet-4-6 (High quality code refactoring)', value: 'claude-sonnet-4-6' },
    { name: 'Anthropic: claude-haiku-4-5 (Fast & cost effective)', value: 'claude-haiku-4-5' },
    { name: 'Anthropic: claude-opus-4-7 (Deep multi-file analysis)', value: 'claude-opus-4-7' },
    { name: 'Anthropic: claude-opus-4-8 (Maximum depth)', value: 'claude-opus-4-8' },
    // Custom
    { name: 'Other custom model name...', value: '__custom__' },
  ];

  const selected = await select<string>({
    message: 'Select LLM model (Mozaik v4 verified list):',
    choices,
    default: defaultChoice,
  });

  if (selected === '__custom__') {
    return await input({
      message: 'Enter custom model name (e.g. your internal proxy model):',
      default: currentValue || 'gpt-5.4',
      validate: (val) => val.trim().length > 0 || 'Model name cannot be empty',
    });
  }

  return selected;
}

/**
 * Runs the interactive full configuration wizard.
 */
async function runInteractiveWizard(isGlobal = false): Promise<void> {
  const { input, select } = await import('@inquirer/prompts');

  console.log(chalk.blue(`\n⚙️  Metamorph Interactive Configuration Wizard`));
  console.log(chalk.gray(`Configuring ${isGlobal ? 'global (~/' + CONFIG_FILE_NAME + ')' : 'local (' + CONFIG_FILE_NAME + ')'} settings.\n`));

  const existing = isGlobal
    ? ConfigStore.loadGlobalConfig() || {}
    : ConfigStore.loadLocalConfig() || {};

  // 1. Model selection with grouped choices
  const finalModel = await promptModelSelection(existing.model);

  // 2. Concurrency
  const concurrencyStr = await input({
    message: 'Maximum concurrent worker/reviewer agents (1-10 recommended):',
    default: String(existing.concurrency ?? DEFAULT_METAMORPH_CONFIG.concurrency),
    validate: (val) => {
      const num = parseInt(val, 10);
      return (!Number.isNaN(num) && num >= 1 && num <= 20) || 'Please enter a number between 1 and 20';
    },
  });
  const concurrency = parseInt(concurrencyStr, 10);

  // 3. Timeout
  const timeoutSecondsStr = await input({
    message: 'Inference timeout per file in seconds:',
    default: String(Math.round((existing.inferenceTimeoutMs ?? DEFAULT_METAMORPH_CONFIG.inferenceTimeoutMs) / 1000)),
    validate: (val) => {
      const num = parseInt(val, 10);
      return (!Number.isNaN(num) && num >= 10 && num <= 600) || 'Please enter a number between 10 and 600 seconds';
    },
  });
  const inferenceTimeoutMs = parseInt(timeoutSecondsStr, 10) * 1000;

  // 4. Max Retries
  const retriesStr = await input({
    message: 'Maximum repair retries per file on review rejection:',
    default: String(existing.maxRetries ?? DEFAULT_METAMORPH_CONFIG.maxRetries),
    validate: (val) => {
      const num = parseInt(val, 10);
      return (!Number.isNaN(num) && num >= 0 && num <= 10) || 'Please enter a number between 0 and 10';
    },
  });
  const maxRetries = parseInt(retriesStr, 10);

  // 5. Max Integration Rounds
  const roundsStr = await input({
    message: 'Maximum shadow workspace build/repair integration rounds:',
    default: String(existing.maxIntegrationRounds ?? DEFAULT_METAMORPH_CONFIG.maxIntegrationRounds),
    validate: (val) => {
      const num = parseInt(val, 10);
      return (!Number.isNaN(num) && num >= 1 && num <= 10) || 'Please enter a number between 1 and 10';
    },
  });
  const maxIntegrationRounds = parseInt(roundsStr, 10);

  const newConfig: Partial<MetamorphConfig> = {
    model: finalModel,
    concurrency,
    inferenceTimeoutMs,
    maxRetries,
    maxIntegrationRounds,
  };

  if (isGlobal) {
    ConfigStore.saveGlobalConfig(newConfig);
    console.log(chalk.green(`\n✅ Global configuration saved to ${ConfigStore.getConfigPath(true)}`));
  } else {
    ConfigStore.saveLocalConfig(newConfig);
    console.log(chalk.green(`\n✅ Local configuration saved to ${ConfigStore.getConfigPath(false)}`));
  }
}

/**
 * Prints the active configuration list.
 */
function printConfigList(): void {
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
  ];

  for (const k of keys) {
    const val = resolved[k];
    if (val !== undefined) {
      console.log(`  • ${chalk.white(k)}: ${chalk.green(String(val))} ${determineSource(k)}`);
    }
  }
  console.log('');
}

/**
 * Registers the 'metamorph config' CLI command and subcommands (init, get, set, list).
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage Metamorph project-level or global configuration (.metamorphrc.json)')
    .action(async () => {
      // Interactive top-level menu when invoked as 'metamorph config' without subcommands
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
          const keyToSet = await select<MetamorphConfigKey>({
            message: 'Select the setting to modify:',
            choices: [
              { name: 'model (Primary LLM model)', value: 'model' },
              { name: 'reviewerModel (Specific reviewer model)', value: 'reviewerModel' },
              { name: 'concurrency (Parallel agent workers)', value: 'concurrency' },
              { name: 'inferenceTimeoutMs (Timeout per file)', value: 'inferenceTimeoutMs' },
              { name: 'maxRetries (Maximum repair attempts)', value: 'maxRetries' },
              { name: 'maxIntegrationRounds (Maximum build repair rounds)', value: 'maxIntegrationRounds' },
            ],
          });

          let finalVal: string | number;
          if (keyToSet === 'model' || keyToSet === 'reviewerModel') {
            finalVal = await promptModelSelection();
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
      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // ─── INIT SUBCOMMAND ───────────────────────────────────────
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

  // ─── GET SUBCOMMAND ────────────────────────────────────────
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

  // ─── SET SUBCOMMAND ────────────────────────────────────────
  configCmd
    .command('set <key> [value]')
    .description('Set a configuration key in .metamorphrc.json')
    .option('-g, --global', 'Persist in global ~/.metamorphrc.json instead of current project')
    .action(async (key: string, rawValue: string | undefined, options: { global?: boolean }) => {
      if (!isMetamorphConfigKey(key)) {
        console.error(chalk.red(`Unknown configuration key: "${key}".`));
        console.log(chalk.gray(`Valid keys: model, reviewerModel, concurrency, inferenceTimeoutMs, maxRetries, maxIntegrationRounds`));
        process.exit(1);
      }

      let parsedValue: unknown = rawValue;

      // If value is omitted and key is a model, prompt interactive selector
      if (!rawValue && (key === 'model' || key === 'reviewerModel')) {
        parsedValue = await promptModelSelection();
      } else if (!rawValue) {
        const { input } = await import('@inquirer/prompts');
        const entered = await input({
          message: `Enter value for ${key}:`,
          validate: (val) => val.trim().length > 0 || 'Value cannot be empty',
        });
        parsedValue = entered;
      }

      // Validate model against Mozaik bundled models
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

      if (options.global) {
        ConfigStore.saveGlobalConfig(update);
        console.log(chalk.green(`✅ Updated global ${key} = ${String(parsedValue)}`));
      } else {
        ConfigStore.saveLocalConfig(update);
        console.log(chalk.green(`✅ Updated local ${key} = ${String(parsedValue)}`));
      }
    });

  // ─── LIST SUBCOMMAND ───────────────────────────────────────
  configCmd
    .command('list')
    .description('List all resolved configuration settings and file locations')
    .action(() => {
      printConfigList();
    });
}
