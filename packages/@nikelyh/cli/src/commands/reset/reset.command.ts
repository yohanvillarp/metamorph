import { Command } from 'commander';
import chalk from 'chalk';
import { SQLiteStateStore } from '@nikelyh/infrastructure';

export async function executeResetAction(): Promise<void> {
  try {
    const store = new SQLiteStateStore('.metamorph');
    await store.reset();
    console.log(chalk.green(`✅ Migration state reset successfully.`));
  } catch (error: unknown) {
    console.error(chalk.red(`❌ Failed to reset: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('Clear all migration history and events from the database')
    .action(executeResetAction);
}
