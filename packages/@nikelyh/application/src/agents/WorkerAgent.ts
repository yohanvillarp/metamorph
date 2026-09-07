import {
  Agent,
  createAgent,
  SituationContext,
  SituationSpecification,
  Tool
} from '@mozaik-ai/core';
import { findMigrationCatalogEntry, formatCatalogRules, SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';
import * as fs from 'fs';
import { collectFileHints } from '../migration/registry';
import { join, leave, resolveRuntime, runLoop, sendEvent } from '../runtime';
import { buildFileTree } from '../utils/FileTreeBuilder';
import { buildNeighborContext } from '../utils/NeighborContext';

// Track retry counts per file to prevent infinite reject-repair loops
const MAX_RETRIES = 2;

class ConcurrencyQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  
  constructor(private concurrencyLimit: number) {}

  async enqueue(task: () => Promise<void>) {
    this.queue.push(task);
    this.pump();
  }

  private async pump() {
    if (this.activeCount >= this.concurrencyLimit || this.queue.length === 0) {
      return;
    }
    const task = this.queue.shift();
    if (task) {
      this.activeCount++;
      try {
        await task();
      } catch (error) {
        console.error('Task error:', error);
      } finally {
        this.activeCount--;
        this.pump();
      }
    }
  }
}

const workerQueue = new ConcurrencyQueue(3); // Maximum 3 concurrent workers

class WhenFileDiscovered extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_DISCOVERED;
  }
}

class WhenFileRejected extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_REJECTED;
  }
}

class WhenFileFatalMismatch extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_FATAL_MISMATCH;
  }
}

class WhenInferenceCompleted extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === 'model.answer' && event.producerId === participant.getId();
  }
}

async function startWorkerLoop(planId: string, filePath: string, prompt: string, participant: Agent): Promise<void> {
  return new Promise(async (originalResolve) => {
    let isDone = false;
    const resolve = () => {
      if (!isDone) {
        isDone = true;
        originalResolve();
      }
    };
    const runtime = resolveRuntime();
    const repository = runtime.state.repository;

    await repository.updateTaskStatus(planId, filePath, 'in_progress');

    const { createAgent: createMozaikAgent } = await import('@mozaik-ai/core');
    
    const tempAgent = createMozaikAgent({
      name: `Worker-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      capabilities: ['code_refactoring', 'inference'],
      instruction: 'You are a staff engineer migrating a real codebase. Deduce from files on disk: read the target and every local module it imports before writing. Never invent callback prop names or re-implement a screen you could import. Prefer evidence over catalog examples.',
      tools: participant.getTools(),
      handlers: [
      {
        specification: new WhenInferenceCompleted(),
        processor: {
          async apply({ event: completionEvent, participant: tempParticipant }) {
            console.log(`[WorkerAgent:${tempParticipant.getId()}] Inference completed. Emitting FILE_MIGRATED.`);
            
            // Read the actual file content from disk (the Worker's tools already wrote it)
            let fileContent = 'No content available';
            try {
              if (fs.existsSync(filePath)) {
                fileContent = fs.readFileSync(filePath, 'utf-8');
                console.log(`[WorkerAgent:${tempParticipant.getId()}] Read ${fileContent.length} chars from ${filePath}`);
              } else {
                console.warn(`[WorkerAgent:${tempParticipant.getId()}] File not found on disk: ${filePath}`);
              }
            } catch (e) {
              console.error(`[WorkerAgent:${tempParticipant.getId()}] Error reading file:`, e);
            }
            
            // Stay in_progress until the Reviewer approves. Marking completed here
            // made the dashboard look finished while reviews and npm install still ran.
            await repository.updateTaskStatus(planId, filePath, 'in_progress');
            
            sendEvent(
              {
                type: SemanticEventName.FILE_MIGRATED,
                producerId: tempParticipant.getId(),
                occurredAt: new Date(),
                payload: {
                  planId: planId,
                  filePath: filePath,
                  diff: fileContent, 
                } as SemanticEventPayloads.FileMigrated,
              },
              tempParticipant.getId()
            );

            leave(tempParticipant);
            resolve();
          }
        }
      }
    ],
  });
  
  join(tempAgent);

  const modelToUse = process.env.METAMORPH_MODEL || 'gpt-5.4';
  
  try {
    console.log(`[WorkerAgent:${tempAgent.getId()}] Starting inference loop for ${filePath}...`);
    runLoop(tempAgent.getId(), prompt, {
      model: modelToUse, 
      context: tempAgent.getMemory().getContext(),
      tools: tempAgent.getTools(),
    });

    setTimeout(async () => {
      if (!isDone) {
        console.error(`[WorkerAgent:${tempAgent.getId()}] Inference timed out.`);
        await repository.updateTaskStatus(planId, filePath, 'failed', 'Inference timed out');
        sendEvent({
          type: SemanticEventName.FILE_FAILED,
          producerId: tempAgent.getId(),
          occurredAt: new Date(),
          payload: { planId, filePath, reason: 'Inference timed out' },
        }, tempAgent.getId());
        leave(tempAgent);
        resolve();
      }
    }, 45000);
  } catch (error: unknown) {
    console.error(`[WorkerAgent:${tempAgent.getId()}] Sync error:`, error);
    if (!isDone) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await repository.updateTaskStatus(planId, filePath, 'failed', errorMessage || 'Sync error');
      sendEvent({
        type: SemanticEventName.FILE_FAILED,
        producerId: tempAgent.getId(),
        occurredAt: new Date(),
        payload: { planId, filePath, reason: errorMessage || 'Sync error' },
      }, tempAgent.getId());
      leave(tempAgent);
      resolve();
    }
  }
  });
}

const workOnFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileDiscovered;
    console.log(`[WorkerAgent] Received file to migrate: ${payload.filePath}`);
    
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(payload.planId);
    let prompt = `You need to migrate the file at path: ${payload.filePath}\n`;
    if (plan) {
      prompt += `Migration Profile: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
      
      const catalogEntry = findMigrationCatalogEntry(plan.profile.source, plan.profile.target);
      if (catalogEntry) {
        prompt += `\nArchitectural rules (all → ${catalogEntry.layer} → frameworks → this pair):\n`;
        prompt += `${formatCatalogRules(catalogEntry.ruleSections)}\n`;
        
        if (catalogEntry.examples && catalogEntry.examples.length > 0) {
          prompt += `\nReference Examples:\n`;
          catalogEntry.examples.forEach(ex => {
            prompt += `Example (${ex.description}):\nBefore:\n\`\`\`\n${ex.before}\n\`\`\`\nAfter:\n\`\`\`\n${ex.after}\n\`\`\`\n\n`;
          });
        }
      }
      
      if (plan.profile.rules) {
        prompt += `Specific User Rules: ${plan.profile.rules.join(', ')}\n`;
      }
      
      if (plan.tasks && plan.tasks.length > 0) {
        const allFiles = plan.tasks.map(t => t.filePath);
        const projectTree = buildFileTree(allFiles);
        prompt += `\nGlobal Project Architecture (Files being migrated):\n`;
        prompt += `\`\`\`text\n${projectTree}\n\`\`\`\n`;
        prompt += `Use this context to ensure your changes align with the overall project structure and other files.\n`;
      }
      prompt += collectFileHints(
        payload.filePath,
        { source: plan.profile.source, target: plan.profile.target },
        catalogEntry?.layer,
      );
    }
    prompt += buildNeighborContext(payload.filePath);
    prompt += `\nYou are not a mechanical find-replace bot. Deduce the correct change from the evidence above and from tools (read_file, list_directory).
Before writing:
1. Read every local import you will call.
2. Keep that module's public prop/export names exactly.
3. If this is a router/bootstrap file, import an existing screen from the nearby paths — do not paste a new copy of its JSX.
Then write the file(s). If structure must change, create/rename/delete accordingly.`;

    workerQueue.enqueue(async () => {
      await startWorkerLoop(payload.planId, payload.filePath, prompt, participant as Agent);
    });
  },
};

const fixRejectedFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileRejected;
    
    // Check retry count
    const retryKey = `${payload.planId}:${payload.filePath}`;
    const retries = resolveRuntime().state.retryCounts;
    if (payload.source === 'integration') {
      retries.delete(retryKey);
    }
    const currentRetries = retries.get(retryKey) || 0;
    
    if (currentRetries >= MAX_RETRIES) {
      console.warn(`[WorkerAgent] File ${payload.filePath} exceeded max retries (${MAX_RETRIES}). Marking as failed.`);
      const runtime = resolveRuntime();
      await runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'failed', `Exceeded max retries (${MAX_RETRIES})`);
      retries.delete(retryKey);
      sendEvent({
        type: SemanticEventName.FILE_FAILED,
        producerId: participant.getId(),
        occurredAt: new Date(),
        payload: { planId: payload.planId, filePath: payload.filePath, reason: `Exceeded max retries (${MAX_RETRIES})` },
      }, participant.getId());
      return;
    }
    
    retries.set(retryKey, currentRetries + 1);
    console.log(`[WorkerAgent] File REJECTED (attempt ${currentRetries + 1}/${MAX_RETRIES}), initiating repair loop: ${payload.filePath}`);
    
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(payload.planId);
    let prompt = `You need to FIX the file at path: ${payload.filePath}\n`;
    if (payload.source === 'integration') {
      prompt += `The Integration Agent rejected this file because the shadow workspace failed npm install / npm run build, or a catalog verifier flagged it.\n`;
      prompt += `If the file does not exist yet, create it. If it is a router/bootstrap file, import existing screens — do not re-implement them or rename their callback props.\n`;
    } else {
      prompt += `Your previous migration was REJECTED by the Quality Assurance Reviewer.\n`;
    }
    prompt += `Feedback/Errors:\n${payload.errors.join('\n')}\n\n`;
    if (plan) {
      prompt += `Migration Profile: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
      
      const catalogEntry = findMigrationCatalogEntry(plan.profile.source, plan.profile.target);
      if (catalogEntry) {
        prompt += `\nArchitectural rules (all → ${catalogEntry.layer} → frameworks → this pair):\n`;
        prompt += `${formatCatalogRules(catalogEntry.ruleSections)}\n`;
      }
      
      if (plan.tasks && plan.tasks.length > 0) {
        const allFiles = plan.tasks.map(t => t.filePath);
        const projectTree = buildFileTree(allFiles);
        prompt += `\nGlobal Project Architecture (Files being migrated):\n`;
        prompt += `\`\`\`text\n${projectTree}\n\`\`\`\n`;
        prompt += `Ensure you respect this overall project structure while fixing the issues.\n`;
      }
      prompt += collectFileHints(
        payload.filePath,
        { source: plan.profile.source, target: plan.profile.target },
        catalogEntry?.layer,
      );
    }
    prompt += buildNeighborContext(payload.filePath);
    prompt += `\nDeduce the fix from the errors and the disk evidence. Read imported modules (and list_directory if you need another screen). Do not guess APIs. Then write the corrected file(s). If the path does not exist, create it. Do not delete existing screens just to make a router file compile.`;

    workerQueue.enqueue(async () => {
      await startWorkerLoop(payload.planId, payload.filePath, prompt, participant as Agent);
    });
  },
};

const fatalMismatchProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileFatalMismatch;
    console.error(`[WorkerAgent] 🛑 FATAL MISMATCH received for ${payload.filePath}. Reason: ${payload.reason}`);
    
    const retryKey = `${payload.planId}:${payload.filePath}`;
    resolveRuntime().state.retryCounts.delete(retryKey);

    const runtime = resolveRuntime();
    await runtime.state.repository.updateTaskStatus(
      payload.planId, 
      payload.filePath, 
      'failed', 
      `Fatal Architectural Mismatch: ${payload.reason}`
    );
    sendEvent({
      type: SemanticEventName.FILE_FAILED,
      producerId: participant.getId(),
      occurredAt: new Date(),
      payload: { planId: payload.planId, filePath: payload.filePath, reason: payload.reason },
    }, participant.getId());
  },
};

export function createWorkerAgent(tools: Tool[]): Agent {
  return createAgent({
    name: 'Worker',
    capabilities: ['code_refactoring', 'inference'],
    instruction: 'You are the Programmer Worker. You migrate code and adapt file structures.',
    tools: tools,
    handlers: [
      { specification: new WhenFileDiscovered(), processor: workOnFileProcessor },
      { specification: new WhenFileRejected(), processor: fixRejectedFileProcessor },
      { specification: new WhenFileFatalMismatch(), processor: fatalMismatchProcessor }
    ],
  });
}
