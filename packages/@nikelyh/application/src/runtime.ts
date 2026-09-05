import { defineRuntime, RuntimeState } from '@mozaik-ai/core';
import { StateRepository } from '@nikelyh/domain';

/**
 * Our global application state for Mozaik.
 * We inject our SQLite repository here so agents can access it from their context.
 */
export class MetamorphState extends RuntimeState {
  constructor(public readonly repository: StateRepository) {
    super();
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
