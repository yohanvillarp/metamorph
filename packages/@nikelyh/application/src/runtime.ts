import { defineRuntime, RuntimeState } from '@mozaik-ai/core';
import { StateRepository } from '@nikelyh/domain';

export interface ReportNote {
  filePath: string;
  outcome: 'migrated' | 'approved' | 'rejected' | 'fatal' | 'failed';
  detail?: string;
}

export interface PlanJournal {
  startedAt: string;
  shadowPath?: string;
  notes: ReportNote[];
  reportLoopActive?: boolean;
  /** One Reporter model call per run, even if Integration restarts. */
  reportStarted?: boolean;
  pendingStatusPhase?: 'completed' | 'failed';
}

/**
 * Shared Mozaik blackboard. LLM quotas stay in agent queues; this is membership-adjacent swarm state.
 */
export class MetamorphState extends RuntimeState {
  dispatcherId?: string;
  readonly journals = new Map<string, PlanJournal>();
  readonly integrationLocks = new Set<string>();
  readonly retryCounts = new Map<string, number>();
  readonly integrationWatchdogs = new Map<string, ReturnType<typeof setInterval>>();

  constructor(public readonly repository: StateRepository) {
    super();
  }

  journal(planId: string): PlanJournal {
    let entry = this.journals.get(planId);
    if (!entry) {
      entry = { startedAt: new Date().toISOString(), notes: [] };
      this.journals.set(planId, entry);
    }
    return entry;
  }
}

const runtimeMethods = defineRuntime<MetamorphState>();
type RuntimeMethods = ReturnType<typeof defineRuntime<MetamorphState>>;

export const initializeRuntime: RuntimeMethods['initializeRuntime'] = runtimeMethods.initializeRuntime;
export const resolveRuntime: RuntimeMethods['resolveRuntime'] = runtimeMethods.resolveRuntime;
export const resolveParticipant: RuntimeMethods['resolveParticipant'] = runtimeMethods.resolveParticipant;
export const join: RuntimeMethods['join'] = runtimeMethods.join;
export const leave: RuntimeMethods['leave'] = runtimeMethods.leave;
export const sendMessage: RuntimeMethods['sendMessage'] = runtimeMethods.sendMessage;
export const sendEvent: RuntimeMethods['sendEvent'] = runtimeMethods.sendEvent;
export const runLoop: RuntimeMethods['runLoop'] = runtimeMethods.runLoop;
