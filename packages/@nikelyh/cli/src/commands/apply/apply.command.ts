import { Command } from 'commander';
import chalk from 'chalk';
import {
  SQLiteStateStore,
  MigrationIntegrator,
  ShadowWorkspace,
} from '@nikelyh/infrastructure';

export async function executeApplyAction(runId: string, targetPath: string): Promise<void> {
  try {
    const store = new SQLiteStateStore('.metamorph');
    const plans = await store.getAllPlans();
    const plan = plans.find((p) => p.runId === runId);

    if (!plan) {
      throw new Error(`Plan for run "${runId}" not found in database.`);
    }
    if (plan.phase !== 'completed' || plan.outcome !== 'success') {
      throw new Error(
        `Cannot apply migration: plan is not completed successfully (phase: "${plan.phase}", outcome: "${plan.outcome || 'none'}"). Only successful migrations can be applied.`
      );
    }
    if (plan.appliedAt) {
      throw new Error(
        `Migration for run "${runId}" has already been applied at ${new Date(plan.appliedAt).toISOString()} to branch ${plan.appliedBranch || 'unknown'}.`
      );
    }

    const integrator = new MigrationIntegrator(new ShadowWorkspace());
    const result = await integrator.applyMigration(runId, targetPath);
    plan.appliedAt = new Date();
    plan.appliedBranch = result.branch;
    await store.savePlan(plan);
    console.log(chalk.green(`✅ ${result.message}`));
  } catch (error: unknown) {
    console.error(chalk.red(`❌ Failed to apply migration: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

export function registerApplyCommand(program: Command): void {
  program
    .command('apply <runId> <targetPath>')
    .description('Apply a completed migration to the target project (requires Git at the project or monorepo root)')
    .action(executeApplyAction);
}
