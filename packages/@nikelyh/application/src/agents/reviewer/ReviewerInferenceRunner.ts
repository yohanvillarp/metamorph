import {
  formatCatalogRules,
  MigrationPlan,
  resolveMigrationCatalog,
  SemanticEventName,
  SemanticEventPayloads,
} from '@nikelyh/domain';
import { InferenceFactory } from '@nikelyh/infrastructure';
import { collectFileHints } from '../../migration/registry';
import { join, leave, resolveRuntime, runLoop, sendEvent } from '../../runtime';
import { buildNeighborContext } from '../../context/NeighborContext';

export interface ReviewParsedResult {
  status: 'APPROVED' | 'REJECTED' | 'FATAL_MISMATCH';
  errors: string[];
}

export function buildReviewPrompt(filePath: string, diff: string, plan?: MigrationPlan | null): string {
  let prompt = `Review the following file migration: ${filePath}\n`;

  if (plan) {
    prompt += `Migration Profile: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
    const catalogEntry = resolveMigrationCatalog(plan.profile.source, plan.profile.target);
    if (catalogEntry) {
      prompt += `\nArchitectural rules (all → ${catalogEntry.layer} → frameworks → this pair; apply only if relevant to this file):\n`;
      prompt += `${formatCatalogRules(catalogEntry.ruleSections)}\n`;
    }
    prompt += collectFileHints(
      filePath,
      { source: plan.profile.source, target: plan.profile.target },
      catalogEntry?.layer
    );
  }

  prompt += `\n${buildNeighborContext(filePath)}\nDiff or new content of the file under review:\n${diff}\nCompare the diff to imported modules in the evidence. If props/exports do not match, REJECT with a specific error. You MUST respond in JSON.`;
  return prompt;
}

async function dispatchReviewResult(
  result: ReviewParsedResult,
  payload: SemanticEventPayloads.FileMigrated,
  participantId: string
): Promise<void> {
  const runtime = resolveRuntime();

  if (result.status === 'APPROVED') {
    console.log(`[Reviewer] File ${payload.filePath} APPROVED!`);
    await runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'completed');
    sendEvent({
      type: SemanticEventName.FILE_REVIEWED,
      producerId: participantId,
      occurredAt: new Date(),
      payload: { planId: payload.planId, filePath: payload.filePath },
    }, participantId);
  } else if (result.status === 'FATAL_MISMATCH') {
    console.error(`[Reviewer] File ${payload.filePath} FATAL_MISMATCH!`, result.errors);
    sendEvent({
      type: SemanticEventName.FILE_FATAL_MISMATCH,
      producerId: participantId,
      occurredAt: new Date(),
      payload: {
        planId: payload.planId,
        filePath: payload.filePath,
        reason: result.errors?.join(' | ') || 'Fundamental architectural mismatch',
      },
    }, participantId);
  } else {
    console.log(`[Reviewer] File ${payload.filePath} REJECTED. Errors:`, result.errors);
    sendEvent({
      type: SemanticEventName.FILE_REJECTED,
      producerId: participantId,
      occurredAt: new Date(),
      payload: {
        planId: payload.planId,
        filePath: payload.filePath,
        errors: result.errors || ['Migration rejected by reviewer'],
      },
    }, participantId);
  }
}

export async function runReviewInference(
  payload: SemanticEventPayloads.FileMigrated,
  prompt: string,
  producerId?: string
): Promise<void> {
  const runtime = resolveRuntime();
  const config = runtime.state.config;
  const modelToUse =
    config?.reviewerModel ||
    config?.model ||
    process.env.METAMORPH_REVIEWER_MODEL ||
    process.env.METAMORPH_MODEL ||
    'gpt-5.4';
  const timeoutMs = config?.inferenceTimeoutMs || 120000;
  const isMock = Boolean(
    config?.model === 'mock' ||
    config?.mock ||
    process.env.METAMORPH_MOCK === '1' ||
    process.env.METAMORPH_MOCK === 'true'
  );

  const plan = await runtime.state.repository.getPlan(payload.planId);
  const inferenceAdapter =
    runtime.state.inferenceAdapter ||
    InferenceFactory.create(config, { join, leave, runLoop });

  const participantId = producerId || runtime.state.dispatcherId || 'System';
  console.log(`[ReviewerAgent:${participantId}] Starting inference for ${payload.filePath} with model ${modelToUse}...`);

  try {
    const response = await inferenceAdapter.runReviewerInference({
      planId: payload.planId,
      filePath: payload.filePath,
      prompt,
      diff: payload.diff,
      modelId: modelToUse,
      timeoutMs,
      sourceFramework: plan?.profile.source,
      targetFramework: plan?.profile.target,
    });

    await dispatchReviewResult(
      { status: response.status, errors: response.errors },
      payload,
      participantId
    );

    sendEvent({
      type: SemanticEventName.TOKENS_REPORTED,
      producerId: participantId,
      occurredAt: new Date(),
      payload: {
        planId: payload.planId,
        agentRole: 'reviewer',
        modelId: modelToUse,
        tokenUsage: response.tokenUsage,
        promptText: prompt,
        completionText: response.rawAnswerText || '',
        isMock,
      } as SemanticEventPayloads.TokensReported,
    }, participantId);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ReviewerAgent:${participantId}] Error in review inference:`, error);
    await runtime.state.repository.updateTaskStatus(
      payload.planId,
      payload.filePath,
      'failed',
      errorMessage || 'Review inference error'
    );
    sendEvent({
      type: SemanticEventName.FILE_FAILED,
      producerId: participantId,
      occurredAt: new Date(),
      payload: {
        planId: payload.planId,
        filePath: payload.filePath,
        reason: errorMessage || 'Review inference error',
      },
    }, participantId);
  }
}
