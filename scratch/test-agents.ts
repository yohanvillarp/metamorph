import { SQLiteStateStore } from '../packages/@nikelyh/infrastructure/src/db/SQLiteStateStore';
import { bootstrapMetamorph, sendEvent, join } from '../packages/@nikelyh/application/src/index';
import { SemanticEventName, SemanticEventPayloads, MigrationPlan } from '../packages/@nikelyh/domain/src/index';

/**
 * Integration Test Script:
 * 1. Instantiates Infrastructure (SQLite)
 * 2. Instantiates Application (Mozaik Agents)
 * 3. Fires a MIGRATION_STARTED event
 * 4. Observes if MapperAgent and WorkerAgent react and mutate the database.
 */
async function run() {
  console.log('--- Phase 1: Setup ---');
  const store = new SQLiteStateStore('.metamorph');
  
  // Seed the DB with a plan to migrate
  const planId = 'integration_plan_001';
  const dummyPlan: MigrationPlan = {
    id: planId,
    profile: { source: 'react', target: 'vue' },
    tasks: [{ filePath: 'src/index.ts', status: 'pending' }],
    createdAt: new Date(),
  };
  await store.savePlan(dummyPlan);

  console.log('--- Phase 2: Mozaik Bootstrap ---');
  // Pass the store into the Application layer
  bootstrapMetamorph(store);

  const { createHuman } = await import('@mozaik-ai/core');
  const human = createHuman({ name: 'System', capabilities: [], handlers: [] });
  join(human);

  console.log('--- Phase 3: Firing Events ---');
  console.log(`[Main] Sending ${SemanticEventName.MIGRATION_STARTED}...`);
  sendEvent(
    {
      type: SemanticEventName.MIGRATION_STARTED,
      producerId: human.getId(),
      occurredAt: new Date(),
      payload: {
        planId: planId,
        profile: dummyPlan.profile,
      } as SemanticEventPayloads.MigrationStarted,
    },
    human.getId()
  );
  
  // Wait a little bit for the reactive event loop to process
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('--- Phase 4: Assertions ---');
  const recovered = await store.getPlan(planId);
  if (recovered && recovered.tasks[0].status === 'in_progress') {
    console.log('✅ EXITO: WorkerAgent successfully reacted and updated SQLite state to in_progress!');
  } else {
    console.log('❌ ERROR: WorkerAgent did not update the database. Status:', recovered?.tasks[0].status);
  }
}

run().catch(console.error);
