import { Command } from 'commander';
import chalk from 'chalk';
import { SQLiteStateStore } from '@nikelyh/infrastructure';

export async function executeListAction(): Promise<void> {
  try {
    const store = new SQLiteStateStore('.metamorph');
    const plans = await store.getAllPlans();
    if (plans.length === 0) {
      console.log(chalk.yellow(`No migration plans found.`));
      return;
    }
    console.log(chalk.blue(`\n📋 Migration Plans:`));
    plans.forEach((p) => {
      console.log(`${chalk.green(p.id)} | ${p.profile.source} -> ${p.profile.target} | Target: ${p.targetPath} | Tasks: ${p.tasks.length}`);
    });
  } catch (error: unknown) {
    console.error(chalk.red(`❌ Failed to list plans: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List past migration plans')
    .action(executeListAction);
}
