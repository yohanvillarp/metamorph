import { SQLiteStateStore } from '../packages/@nikelyh/infrastructure/src/db/SQLiteStateStore';
import { MigrationPlan } from '../packages/@nikelyh/domain/src/entities/MigrationPlan';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Test script to verify the basic functionality of the SQLiteStateStore.
 * It creates a local database, inserts a mock migration plan, updates its tasks,
 * and asserts that the data is retrieved correctly.
 */
async function run() {
  console.log('Cleaning up previous database...');
  try {
    unlinkSync(join('.metamorph', 'history.db'));
  } catch (e) {
    // Ignore error if file doesn't exist
  }

  console.log('Initializing SQLiteStateStore...');
  const store = new SQLiteStateStore('.metamorph');

  const dummyPlan: MigrationPlan = {
    id: 'plan_123',
    profile: {
      source: 'express',
      target: 'fastify',
      rules: ['change res to reply'],
    },
    tasks: [
      {
        filePath: 'src/index.ts',
        status: 'pending',
      },
    ],
    createdAt: new Date(),
  };

  console.log('Saving migration plan...');
  await store.savePlan(dummyPlan);

  console.log('Updating task status to in_progress...');
  await store.updateTaskStatus('plan_123', 'src/index.ts', 'in_progress');

  console.log('Logging semantic test event...');
  await store.logEvent('file.discovered', { filePath: 'src/index.ts' });

  console.log('Retrieving plan from SQLite...');
  const recovered = await store.getPlan('plan_123');
  
  if (recovered && recovered.tasks[0].status === 'in_progress') {
    console.log('SUCCESS: Data was saved and retrieved correctly.');
    console.dir(recovered, { depth: null });
  } else {
    console.error('ERROR: Retrieved data does not match expectations.');
  }
}

run().catch(console.error);
