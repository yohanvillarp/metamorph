import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { planReadyForIntegration } from './planReady';
import { MigrationPlan } from '@nikelyh/domain';

describe('planReadyForIntegration', () => {
  const basePlan: MigrationPlan = {
    id: 'test-plan',
    runId: 'run-123',
    profile: { source: 'react', target: 'next' },
    createdAt: new Date(),
    tasks: [],
  };

  test('returns false if phase is already integration', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'integration',
      tasks: [
        { filePath: 'system:package_manager', status: 'completed' },
        { filePath: 'src/App.tsx', status: 'completed' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), false);
  });

  test('returns false if phase is already completed', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'completed',
      tasks: [
        { filePath: 'system:package_manager', status: 'completed' },
        { filePath: 'src/App.tsx', status: 'completed' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), false);
  });

  test('returns false if phase is already failed', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'failed',
      tasks: [
        { filePath: 'system:package_manager', status: 'completed' },
        { filePath: 'src/App.tsx', status: 'completed' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), false);
  });

  test('returns false if there are no file tasks to migrate', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'files',
      tasks: [
        { filePath: 'system:package_manager', status: 'completed' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), false);
  });

  test('returns false if package manager is still pending', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'files',
      tasks: [
        { filePath: 'system:package_manager', status: 'pending' },
        { filePath: 'src/App.tsx', status: 'completed' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), false);
  });

  test('returns false if package manager is in_progress', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'files',
      tasks: [
        { filePath: 'system:package_manager', status: 'in_progress' },
        { filePath: 'src/App.tsx', status: 'completed' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), false);
  });

  test('returns false if any file task is still pending', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'files',
      tasks: [
        { filePath: 'system:package_manager', status: 'completed' },
        { filePath: 'src/App.tsx', status: 'completed' },
        { filePath: 'src/Button.tsx', status: 'pending' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), false);
  });

  test('returns false if any file task is still in_progress', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'files',
      tasks: [
        { filePath: 'system:package_manager', status: 'completed' },
        { filePath: 'src/App.tsx', status: 'in_progress' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), false);
  });

  test('returns true when all files are terminal (completed) and packages ready', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'files',
      tasks: [
        { filePath: 'system:package_manager', status: 'completed' },
        { filePath: 'src/App.tsx', status: 'completed' },
        { filePath: 'src/Button.tsx', status: 'completed' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), true);
  });

  test('returns true when some files are failed and some completed, as long as all are terminal', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'files',
      tasks: [
        { filePath: 'system:package_manager', status: 'completed' },
        { filePath: 'src/App.tsx', status: 'completed' },
        { filePath: 'src/Broken.tsx', status: 'failed', error: 'Syntax error' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), true);
  });

  test('returns true if package manager failed but files are terminal', () => {
    const plan: MigrationPlan = {
      ...basePlan,
      phase: 'files',
      tasks: [
        { filePath: 'system:package_manager', status: 'failed' },
        { filePath: 'src/App.tsx', status: 'completed' },
      ],
    };
    assert.equal(planReadyForIntegration(plan), true);
  });
});
