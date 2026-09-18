export const SWARM_AGENTS = [
  { id: 'Mapper', color: '#eab308', hint: 'Discovers files to migrate' },
  { id: 'Worker', color: '#3b82f6', hint: 'Rewrites files in the shadow workspace' },
  { id: 'Reviewer', color: '#a855f7', hint: 'Approves or rejects each file' },
  { id: 'Integration', color: '#06b6d4', hint: 'npm install, build, and cross-file fixes' },
  { id: 'Reporter', color: '#22c55e', hint: 'Writes MIGRATION.md for you' },
] as const;

export type SwarmAgentId = (typeof SWARM_AGENTS)[number]['id'];

export function classifySwarmAgent(eventName: string, payload?: Record<string, unknown>): SwarmAgentId | null {
  const name = String(eventName ?? '').toLowerCase();
  const message = String(payload?.message ?? '').toLowerCase();
  const producer = String(payload?.producerId ?? '').toLowerCase();

  if (name.includes('discover')) return 'Mapper';
  if (name.includes('file.migrated')) return 'Worker';
  if (name.includes('file.rejected') && (payload?.source === 'integration' || /integration/.test(producer))) {
    return 'Integration';
  }
  if (name.includes('review') || name.includes('reject') || name.includes('fatal')) return 'Reviewer';
  if (/reporter/.test(producer) || (name.includes('system.log') && /report|migration\.md/.test(message))) {
    return 'Reporter';
  }
  if (name.includes('phase.packages')) return 'Integration';
  if (
    name.includes('phase.integration')
    || /integration/.test(producer)
    || /npm |install|shadow build|run build|app router|verifier/.test(message)
  ) {
    return 'Integration';
  }
  return null;
}
