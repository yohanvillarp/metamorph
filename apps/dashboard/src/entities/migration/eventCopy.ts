import { classifySwarmAgent, type SwarmAgentId } from './agents';

const EVENT_TITLES: Record<string, string> = {
  'migration.started': 'Migration started',
  'file.discovered': 'File queued',
  'file.migrated': 'Worker finished a file',
  'file.reviewed': 'Reviewer approved a file',
  'file.rejected': 'File sent back for repair',
  'file.fatal_mismatch': 'Architecture mismatch',
  'file.failed': 'File repair budget exhausted',
  'phase.packages_ready': 'Package.json updated',
  'phase.integration_started': 'Install / build started',
  'migration.completed': 'Swarm finished',
  'migration.applied': 'Applied to your repo',
  'system.log': 'Status update',
};

export function humanEventTitle(eventName: string): string {
  const key = String(eventName ?? '').toLowerCase();
  if (EVENT_TITLES[key]) return EVENT_TITLES[key];
  if (key.includes('system.log')) return 'Status update';
  return String(eventName ?? 'Event').replace(/[._]/g, ' ');
}

export function eventHeadline(eventName: string, payload?: Record<string, unknown>): string {
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  const file = typeof payload?.filePath === 'string' ? payload.filePath.replace(/\\/g, '/').split('/').slice(-2).join('/') : '';
  const title = humanEventTitle(eventName);
  return file ? `${title}: ${file}` : title;
}

export function eventLevel(eventName: string, payload?: Record<string, unknown>): 'info' | 'warning' | 'error' {
  const level = String(payload?.level ?? '').toLowerCase();
  if (level === 'error' || String(eventName).includes('fatal') || String(eventName).includes('reject')) return 'error';
  if (level === 'warning') return 'warning';
  return 'info';
}

export function eventAgent(eventName: string, payload?: Record<string, unknown>): SwarmAgentId | 'System' {
  return classifySwarmAgent(eventName, payload) ?? 'System';
}
