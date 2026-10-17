import { Agent } from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';
import { InferenceFactory } from '@nikelyh/infrastructure';
import * as fs from 'fs';
import { join, leave, resolveRuntime, runLoop, sendEvent } from '../../runtime';
import { findShadowRoot } from '../../analysis/NextMigrationHints';
import { MISSING_AFTER_WORKER, workerCompletionKind } from '../../analysis/workerCompletion';

async function handleCompletedInference(params: {
  tempParticipant: { getId(): string };
  filePath: string;
  planId: string;
}): Promise<void> {
  const { tempParticipant, filePath, planId } = params;
  const runtime = resolveRuntime();
  const repository = runtime.state.repository;

  const exists = fs.existsSync(filePath);
  if (workerCompletionKind(exists) === 'failed_missing') {
    console.warn(`[WorkerAgent:${tempParticipant.getId()}] File not found on disk after inference: ${filePath}`);
    await repository.updateTaskStatus(planId, filePath, 'failed', MISSING_AFTER_WORKER);
    sendEvent({
      type: SemanticEventName.FILE_FAILED,
      producerId: tempParticipant.getId(),
      occurredAt: new Date(),
      payload: { planId, filePath, reason: MISSING_AFTER_WORKER },
    }, tempParticipant.getId());
    return;
  }

  let fileContent = '';
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`[WorkerAgent:${tempParticipant.getId()}] Read ${fileContent.length} chars from ${filePath}`);
  } catch (e) {
    console.error(`[WorkerAgent:${tempParticipant.getId()}] Error reading file:`, e);
  }

  console.log(`[WorkerAgent:${tempParticipant.getId()}] Inference completed. Emitting FILE_MIGRATED.`);
  await repository.updateTaskStatus(planId, filePath, 'in_progress');

  sendEvent({
    type: SemanticEventName.FILE_MIGRATED,
    producerId: tempParticipant.getId(),
    occurredAt: new Date(),
    payload: {
      planId,
      filePath,
      diff: fileContent,
    } as SemanticEventPayloads.FileMigrated,
  }, tempParticipant.getId());
}

export async function startWorkerLoop(
  planId: string,
  filePath: string,
  prompt: string,
  participant: Agent
): Promise<void> {
  const runtime = resolveRuntime();
  const repository = runtime.state.repository;
  await repository.updateTaskStatus(planId, filePath, 'in_progress');

  const config = runtime.state.config;
  const modelToUse = config?.model || process.env.METAMORPH_MODEL || 'gpt-5.4';
  const timeoutMs = config?.inferenceTimeoutMs || 120000;
  const isMock = Boolean(
    config?.model === 'mock' ||
    config?.mock ||
    process.env.METAMORPH_MOCK === '1' ||
    process.env.METAMORPH_MOCK === 'true'
  );

  const shadowRoot = findShadowRoot(filePath);
  const plan = await repository.getPlan(planId);

  const inferenceAdapter =
    runtime.state.inferenceAdapter ||
    InferenceFactory.create(config, { join, leave, runLoop });

  console.log(`[WorkerAgent:${participant.getId()}] Starting inference loop for ${filePath}...`);
  try {
    const result = await inferenceAdapter.runWorkerInference({
      planId,
      filePath,
      prompt,
      modelId: modelToUse,
      timeoutMs,
      shadowRoot: shadowRoot || undefined,
      sourceFramework: plan?.profile.source,
      targetFramework: plan?.profile.target,
    });

    if (result.success) {
      await handleCompletedInference({ tempParticipant: participant, filePath, planId });
      sendEvent({
        type: SemanticEventName.TOKENS_REPORTED,
        producerId: participant.getId(),
        occurredAt: new Date(),
        payload: {
          planId,
          agentRole: 'worker',
          modelId: modelToUse,
          tokenUsage: result.tokenUsage,
          promptText: prompt,
          completionText: result.completionContent || (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''),
          isMock,
        } as SemanticEventPayloads.TokensReported,
      }, participant.getId());
    } else {
      const errorMessage = result.error || 'Inference error';
      await repository.updateTaskStatus(planId, filePath, 'failed', errorMessage);
      sendEvent({
        type: SemanticEventName.FILE_FAILED,
        producerId: participant.getId(),
        occurredAt: new Date(),
        payload: { planId, filePath, reason: errorMessage },
      }, participant.getId());
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await repository.updateTaskStatus(planId, filePath, 'failed', errorMessage);
    sendEvent({
      type: SemanticEventName.FILE_FAILED,
      producerId: participant.getId(),
      occurredAt: new Date(),
      payload: { planId, filePath, reason: errorMessage },
    }, participant.getId());
  }
}
