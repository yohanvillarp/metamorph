import 'dotenv/config';
import { SQLiteStateStore, createReadFileTool, createWriteFileTool } from '../packages/@nikelyh/infrastructure/src/index';
import { bootstrapMetamorph, sendEvent, join } from '../packages/@nikelyh/application/src/index';
import { SemanticEventName } from '../packages/@nikelyh/domain/src/index';
/**
 * Integration Test Script:
 * 1. Instantiates Infrastructure (SQLite & AST Tools)
 * 2. Instantiates Application (Mozaik Agents)
 * 3. Fires a MIGRATION_STARTED event
 * 4. Observes if MapperAgent and WorkerAgent react and mutate the database and file.
 */
async function run() {
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        console.warn('⚠️ WARNING: No LLM API key detected in env. Inference will fail.');
    }
    console.log('--- Phase 1: Setup ---');
    const store = new SQLiteStateStore('.metamorph');
    // Seed the DB with a plan to migrate
    const planId = 'integration_plan_002';
    const dummyPlan = {
        id: planId,
        profile: { source: 'express', target: 'fastify', rules: ['Change `res.send` to `reply.send`', 'Change `app.get` types if necessary'] },
        tasks: [{ filePath: 'scratch/dummy-express.ts', status: 'pending' }],
        createdAt: new Date(),
    };
    await store.savePlan(dummyPlan);
    const tools = [createReadFileTool(), createWriteFileTool()];
    console.log('--- Phase 2: Mozaik Bootstrap ---');
    bootstrapMetamorph(store, tools);
    const { createHuman } = await import('@mozaik-ai/core');
    const human = createHuman({ name: 'System', capabilities: [], handlers: [] });
    join(human);
    console.log('--- Phase 3: Firing Events ---');
    console.log(`[Main] Sending ${SemanticEventName.MIGRATION_STARTED}...`);
    sendEvent({
        type: SemanticEventName.MIGRATION_STARTED,
        producerId: human.getId(),
        occurredAt: new Date(),
        payload: {
            planId: planId,
            profile: dummyPlan.profile,
        },
    }, human.getId());
    console.log('[Main] Event sent. Waiting 15 seconds for inference to complete...');
    await new Promise((resolve) => setTimeout(resolve, 15000));
    console.log('--- Phase 4: Assertions ---');
    const recovered = await store.getPlan(planId);
    if (recovered && recovered.tasks[0].status === 'in_progress') {
        console.log('✅ EXITO: WorkerAgent successfully reacted and updated SQLite state to in_progress!');
    }
    else {
        console.log('❌ ERROR: WorkerAgent did not update the database. Status:', recovered?.tasks[0].status);
    }
}
run().catch(console.error);
