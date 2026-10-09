import chalk from 'chalk';
import { ConfigStore, CONFIG_FILE_NAME } from '@nikelyh/infrastructure';
import {
  MetamorphConfig,
  DEFAULT_METAMORPH_CONFIG,
  isMozaikBundledModel,
} from '@nikelyh/domain';

/**
 * Interactive model picker displaying officially supported Mozaik v4 bundled models.
 */
export async function promptModelSelection(currentValue?: string): Promise<string> {
  const { select, input } = await import('@inquirer/prompts');

  const defaultChoice = currentValue && isMozaikBundledModel(currentValue)
    ? currentValue
    : DEFAULT_METAMORPH_CONFIG.model;

  const choices: { name: string; value: string }[] = [
    { name: 'OpenAI: gpt-5.4 (Recommended default - Stable)', value: 'gpt-5.4' },
    { name: 'OpenAI: gpt-5.4-mini (Fast & efficient)', value: 'gpt-5.4-mini' },
    { name: 'OpenAI: gpt-5.4-nano (Ultra lightweight)', value: 'gpt-5.4-nano' },
    { name: 'OpenAI: gpt-5.5 (High capability reasoning)', value: 'gpt-5.5' },
    { name: 'Anthropic: claude-sonnet-4-6 (High quality code refactoring)', value: 'claude-sonnet-4-6' },
    { name: 'Anthropic: claude-haiku-4-5 (Fast & cost effective)', value: 'claude-haiku-4-5' },
    { name: 'Anthropic: claude-opus-4-7 (Deep multi-file analysis)', value: 'claude-opus-4-7' },
    { name: 'Anthropic: claude-opus-4-8 (Maximum depth)', value: 'claude-opus-4-8' },
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
export async function runInteractiveWizard(isGlobal = false): Promise<void> {
  const { input } = await import('@inquirer/prompts');

  console.log(chalk.blue(`\n⚙️  Metamorph Interactive Configuration Wizard`));
  console.log(chalk.gray(`Configuring ${isGlobal ? 'global (~/' + CONFIG_FILE_NAME + ')' : 'local (' + CONFIG_FILE_NAME + ')'} settings.\n`));

  const existing = isGlobal
    ? ConfigStore.loadGlobalConfig() || {}
    : ConfigStore.loadLocalConfig() || {};

  const finalModel = await promptModelSelection(existing.model);

  const concurrencyStr = await input({
    message: 'Maximum concurrent worker/reviewer agents (1-10 recommended):',
    default: String(existing.concurrency ?? DEFAULT_METAMORPH_CONFIG.concurrency),
    validate: (val) => {
      const num = parseInt(val, 10);
      return (!Number.isNaN(num) && num >= 1 && num <= 20) || 'Please enter a number between 1 and 20';
    },
  });
  const concurrency = parseInt(concurrencyStr, 10);

  const timeoutSecondsStr = await input({
    message: 'Inference timeout per file in seconds:',
    default: String(Math.round((existing.inferenceTimeoutMs ?? DEFAULT_METAMORPH_CONFIG.inferenceTimeoutMs) / 1000)),
    validate: (val) => {
      const num = parseInt(val, 10);
      return (!Number.isNaN(num) && num >= 10 && num <= 600) || 'Please enter a number between 10 and 600 seconds';
    },
  });
  const inferenceTimeoutMs = parseInt(timeoutSecondsStr, 10) * 1000;

  const retriesStr = await input({
    message: 'Maximum repair retries per file on review rejection:',
    default: String(existing.maxRetries ?? DEFAULT_METAMORPH_CONFIG.maxRetries),
    validate: (val) => {
      const num = parseInt(val, 10);
      return (!Number.isNaN(num) && num >= 0 && num <= 10) || 'Please enter a number between 0 and 10';
    },
  });
  const maxRetries = parseInt(retriesStr, 10);

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
