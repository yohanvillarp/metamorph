import { Command } from 'commander';
import chalk from 'chalk';
import { SQLiteStateStore } from '@nikelyh/infrastructure';
import { MigrationRunner } from '@nikelyh/application';

export async function executeRollbackAction(runId: string): Promise<void> {
  try {
    const store = new SQLiteStateStore('.metamorph');
    const runner = new MigrationRunner(store, []);
    await runner.rollbackMigration(runId);
    console.log(chalk.green(`✅ Rolled back run: ${runId}`));
  } catch (error: unknown) {
    console.error(chalk.red(`❌ Failed to rollback: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

export function registerRollbackCommand(program: Command): void {
  program
    .command('rollback <runId>')
    .description('Rollback and discard an unapplied migration shadow workspace')
    .action(executeRollbackAction);
}
