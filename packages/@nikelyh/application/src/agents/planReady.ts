import { MigrationPlan } from '@nikelyh/domain';

export function planReadyForIntegration(plan: MigrationPlan): boolean {
  if (plan.phase === 'integration' || plan.phase === 'completed' || plan.phase === 'failed') {
    return false;
  }

  const files = plan.tasks.filter((task) => !task.filePath.startsWith('system:'));
  if (files.length === 0) return false;

  const packages = plan.tasks.find((task) => task.filePath === 'system:package_manager');
  if (packages && packages.status !== 'completed' && packages.status !== 'failed') {
    return false;
  }

  const live = plan.tasks.filter((task) => !task.filePath.startsWith('system:'));
  if (live.some((task) => task.status === 'pending' || task.status === 'in_progress')) {
    return false;
  }

  return live.every((task) => task.status === 'completed' || task.status === 'failed');
}
