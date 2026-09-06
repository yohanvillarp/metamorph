import * as fs from 'fs';
import {
  Agent,
  createAgent,
  SituationContext,
  SituationSpecification,
  Tool
} from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads, findMigrationCatalogEntry } from '@nikelyh/domain';
import { join, leave, resolveRuntime, runLoop, sendEvent } from '../runtime';
import { buildFileTree } from '../utils/FileTreeBuilder';

// Track retry counts per file to prevent infinite reject-repair loops
const retryCountMap = new Map<string, number>();
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

const workerQueue = new ConcurrencyQueue(2); // Maximum 2 concurrent workers

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

    console.log(`[WorkerAgent] Marking file as 'in_progress' in database...`);
    await repository.updateTaskStatus(planId, filePath, 'in_progress');

    const { createAgent: createMozaikAgent } = await import('@mozaik-ai/core');
    
    const tempAgent = createMozaikAgent({
      name: `Worker-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      capabilities: ['code_refactoring', 'inference'],
      instruction: 'You are the Programmer Worker. Your job is to refactor specific files based on the migration profile. If the target framework requires a different file structure, you are authorized to use your tools to rename, create, or delete files to adhere to architectural rules. When you are done modifying the file(s), simply finish your response.',
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
            
            await repository.updateTaskStatus(planId, filePath, 'completed');
            
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
        leave(tempAgent);
        resolve();
      }
    }, 45000);
  } catch (error: unknown) {
    console.error(`[WorkerAgent:${tempAgent.getId()}] Sync error:`, error);
    if (!isDone) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await repository.updateTaskStatus(planId, filePath, 'failed', errorMessage || 'Sync error');
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
        prompt += `\nStrict Architectural Rules for this Migration:\n`;
        catalogEntry.architecturalRules.forEach(rule => prompt += `- ${rule}\n`);
        
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
    }
    prompt += `Please read the file using your tools, rewrite it according to the rules, and write it back. If the rules require breaking this file into multiple files, use your create, rename, or delete file tools accordingly.`;

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
    const currentRetries = retryCountMap.get(retryKey) || 0;
    
    if (currentRetries >= MAX_RETRIES) {
      console.warn(`[WorkerAgent] File ${payload.filePath} exceeded max retries (${MAX_RETRIES}). Marking as failed.`);
      const runtime = resolveRuntime();
      await runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'failed', `Exceeded max retries (${MAX_RETRIES})`);
      retryCountMap.delete(retryKey);
      return;
    }
    
    retryCountMap.set(retryKey, currentRetries + 1);
    console.log(`[WorkerAgent] File REJECTED (attempt ${currentRetries + 1}/${MAX_RETRIES}), initiating repair loop: ${payload.filePath}`);
    
    const runtime = resolveRuntime();
    const plan = await runtime.state.repository.getPlan(payload.planId);
    let prompt = `You need to FIX the file at path: ${payload.filePath}\n`;
    prompt += `Your previous migration was REJECTED by the Quality Assurance Reviewer.\n`;
    prompt += `Feedback/Errors:\n${payload.errors.join('\n')}\n\n`;
    if (plan) {
      prompt += `Migration Profile: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
      
      const catalogEntry = findMigrationCatalogEntry(plan.profile.source, plan.profile.target);
      if (catalogEntry) {
        prompt += `\nStrict Architectural Rules for this Migration:\n`;
        catalogEntry.architecturalRules.forEach(rule => prompt += `- ${rule}\n`);
      }
      
      if (plan.tasks && plan.tasks.length > 0) {
        const allFiles = plan.tasks.map(t => t.filePath);
        const projectTree = buildFileTree(allFiles);
        prompt += `\nGlobal Project Architecture (Files being migrated):\n`;
        prompt += `\`\`\`text\n${projectTree}\n\`\`\`\n`;
        prompt += `Ensure you respect this overall project structure while fixing the issues.\n`;
      }
    }
    prompt += `Please read the file, fix the issues mentioned, and write it back. You may restructure the files if the architectural rules demand it.`;

    workerQueue.enqueue(async () => {
      await startWorkerLoop(payload.planId, payload.filePath, prompt, participant as Agent);
    });
  },
};

const fatalMismatchProcessor = {
  async apply({ event }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileFatalMismatch;
    console.error(`[WorkerAgent] 🛑 FATAL MISMATCH received for ${payload.filePath}. Reason: ${payload.reason}`);
    
    // Clean up retry count since we are aborting
    const retryKey = `${payload.planId}:${payload.filePath}`;
    retryCountMap.delete(retryKey);

    const runtime = resolveRuntime();
    await runtime.state.repository.updateTaskStatus(
      payload.planId, 
      payload.filePath, 
      'failed', 
      `Fatal Architectural Mismatch: ${payload.reason}`
    );
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
