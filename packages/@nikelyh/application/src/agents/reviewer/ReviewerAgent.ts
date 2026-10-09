import {
  Agent,
  createAgent,
  SituationContext,
  SituationHandler,
  SituationSpecification,
  Tool,
} from '@mozaik-ai/core';
import { SemanticEventName, SemanticEventPayloads } from '@nikelyh/domain';
import { resolveRuntime, sendEvent } from '../../runtime';
import { ConcurrencyQueue } from '../../concurrency/ConcurrencyQueue';
import { validateTypeScriptSyntax } from './SyntaxValidator';
import { verifyMissingFile, verifyAppRouterStructure } from './StructureVerifier';
import { buildReviewPrompt, runReviewInference } from './ReviewerInferenceRunner';

export const reviewerQueue = new ConcurrencyQueue(3);

class WhenFileMigrated extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === SemanticEventName.FILE_MIGRATED;
  }
}

function syncReviewerQueueLimit(): void {
  const runtime = resolveRuntime();
  if (runtime.state.config && reviewerQueue.getLimit() !== runtime.state.config.concurrency) {
    reviewerQueue.setLimit(runtime.state.config.concurrency);
  }
}

async function handleMissingFileVerdict(
  payload: SemanticEventPayloads.FileMigrated,
  participantId: string
): Promise<boolean> {
  const runtime = resolveRuntime();
  const plan = await runtime.state.repository.getPlan(payload.planId);
  const check = verifyMissingFile(payload.filePath, plan);

  if (check.passed && !check.isMissingApproved) {
    return false; // File actually exists, proceed with review
  }

  if (check.isMissingApproved) {
    console.log(`[Reviewer] Missing ${payload.filePath} approved: ${check.reason}`);
    await runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'completed');
    sendEvent({
      type: SemanticEventName.FILE_REVIEWED,
      producerId: participantId,
      occurredAt: new Date(),
      payload: { planId: payload.planId, filePath: payload.filePath },
    }, participantId);
  } else {
    console.log(`[Reviewer] Missing ${payload.filePath} rejected:`, check.errors);
    sendEvent({
      type: SemanticEventName.FILE_REJECTED,
      producerId: participantId,
      occurredAt: new Date(),
      payload: {
        planId: payload.planId,
        filePath: payload.filePath,
        errors: check.errors || ['File does not exist and has no demonstrable replacement'],
      },
    }, participantId);
  }

  return true; // Missing file handling complete
}

async function handlePreInferenceValidation(
  payload: SemanticEventPayloads.FileMigrated,
  participantId: string
): Promise<boolean> {
  const syntax = await validateTypeScriptSyntax(payload.filePath);
  if (!syntax.isValid && syntax.errors) {
    console.error(`[Reviewer] Syntax Error in ${payload.filePath}. Rejecting immediately.`);
    sendEvent({
      type: SemanticEventName.FILE_REJECTED,
      producerId: participantId,
      occurredAt: new Date(),
      payload: { planId: payload.planId, filePath: payload.filePath, errors: syntax.errors },
    }, participantId);
    return false;
  }

  const runtime = resolveRuntime();
  const plan = await runtime.state.repository.getPlan(payload.planId);
  const structure = verifyAppRouterStructure(payload.filePath, plan);
  if (!structure.passed && structure.errors) {
    console.error(`[Reviewer] Structure verifier rejected ${payload.filePath}.`, structure.errors);
    sendEvent({
      type: SemanticEventName.FILE_REJECTED,
      producerId: participantId,
      occurredAt: new Date(),
      payload: { planId: payload.planId, filePath: payload.filePath, errors: structure.errors },
    }, participantId);
    return false;
  }

  return true;
}

const reviewFileProcessor = {
  async apply({ event, participant }: SituationContext) {
    const payload = event.payload as SemanticEventPayloads.FileMigrated;
    syncReviewerQueueLimit();

    reviewerQueue.enqueue(async () => {
      const participantId = participant.getId();
      const isMissingHandled = await handleMissingFileVerdict(payload, participantId);
      if (isMissingHandled) return;

      const isValid = await handlePreInferenceValidation(payload, participantId);
      if (!isValid) return;

      const runtime = resolveRuntime();
      const plan = await runtime.state.repository.getPlan(payload.planId);
      const prompt = buildReviewPrompt(payload.filePath, payload.diff, plan);
      await runReviewInference(payload, prompt);
    });
  },
};

const reviewFileHandler: SituationHandler = {
  specification: new WhenFileMigrated(),
  processor: reviewFileProcessor,
};

export function createReviewerAgent(tools: Tool[]): Agent {
  return createAgent({
    name: 'Reviewer',
    capabilities: ['code_review', 'inference'],
    instruction: 'You are the Reviewer Worker.',
    tools: [],
    handlers: [reviewFileHandler],
  });
}

/**
 * Deterministic bypass agent used when ReviewerAgent is disabled.
 * Automatically marks migrated files as reviewed/completed without LLM inference,
 * allowing fast-mode migrations to rely directly on IntegrationAgent shadow build diagnostics.
 */
export function createReviewerBypassAgent(): Agent {
  return createAgent({
    name: 'ReviewerBypass',
    capabilities: ['code_review'],
    instruction: 'You auto-approve migrated files when Reviewer is disabled, delegating diagnostics strictly to shadow build.',
    tools: [],
    handlers: [
      {
        specification: new WhenFileMigrated(),
        processor: {
          async apply({ event, participant }: SituationContext) {
            const payload = event.payload as SemanticEventPayloads.FileMigrated;
            const runtime = resolveRuntime();
            await runtime.state.repository.updateTaskStatus(payload.planId, payload.filePath, 'completed');

            const participantId = participant.getId();
            sendEvent({
              type: SemanticEventName.FILE_REVIEWED,
              producerId: participantId,
              occurredAt: new Date(),
              payload: { planId: payload.planId, filePath: payload.filePath },
            }, participantId);
          },
        },
      },
    ],
  });
}

