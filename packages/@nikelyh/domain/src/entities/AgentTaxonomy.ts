/**
 * Agent Taxonomy & Identification
 * Core vs. Auxiliary classifications for swarm participants.
 * Zero-I/O Domain Entity.
 */

export type CoreAgentId =
  | 'coordinator'
  | 'mapper'
  | 'worker'
  | 'packagemanager'
  | 'integration';

export type AuxiliaryAgentId =
  | 'reporter'
  | 'reviewer'
  | 'accounting';

export type SwarmAgentId = CoreAgentId | AuxiliaryAgentId;

export const CORE_AGENTS: readonly CoreAgentId[] = [
  'coordinator',
  'mapper',
  'worker',
  'packagemanager',
  'integration',
] as const;

export const AUXILIARY_AGENTS: readonly AuxiliaryAgentId[] = [
  'reporter',
  'reviewer',
  'accounting',
] as const;

export const ALL_SWARM_AGENTS: readonly SwarmAgentId[] = [
  ...CORE_AGENTS,
  ...AUXILIARY_AGENTS,
] as const;

export function isCoreAgentId(id: string): id is CoreAgentId {
  return (CORE_AGENTS as readonly string[]).includes(id.toLowerCase() as CoreAgentId);
}

export function isAuxiliaryAgentId(id: string): id is AuxiliaryAgentId {
  return (AUXILIARY_AGENTS as readonly string[]).includes(id.toLowerCase() as AuxiliaryAgentId);
}

export interface DisabledAgentsValidationResult {
  valid: boolean;
  disabled: AuxiliaryAgentId[];
  error?: string;
}

/**
 * Pure validation function that ensures only auxiliary agents are disabled.
 * Returns an error if a core agent or an unknown agent is specified.
 */
export function validateDisabledAgents(
  agentNames: readonly string[]
): DisabledAgentsValidationResult {
  const normalized: AuxiliaryAgentId[] = [];

  for (const rawName of agentNames) {
    const clean = rawName.trim().toLowerCase();
    if (!clean) continue;

    if (isCoreAgentId(clean)) {
      return {
        valid: false,
        disabled: [],
        error: `Cannot disable core agent '${clean}'. Only auxiliary agents [${AUXILIARY_AGENTS.join(', ')}] can be disabled.`,
      };
    }

    if (!isAuxiliaryAgentId(clean)) {
      return {
        valid: false,
        disabled: [],
        error: `Unknown agent '${clean}'. Available auxiliary agents to disable: [${AUXILIARY_AGENTS.join(', ')}].`,
      };
    }

    if (!normalized.includes(clean)) {
      normalized.push(clean);
    }
  }

  return {
    valid: true,
    disabled: normalized,
  };
}
