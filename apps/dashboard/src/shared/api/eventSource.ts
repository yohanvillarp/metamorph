import type { MigrationEventItem } from './types';

const API_BASE = '';

export type PlanChangeReason = 'saved' | 'task' | 'reset';

export interface SSEPlanChange {
  reason: PlanChangeReason;
  planId: string | null;
}

/** A streamed event; the persisted row id is not known until the next hydration. */
export type SSEMigrationEvent = Omit<MigrationEventItem, 'id'>;

export interface MigrationStreamCallbacks {
  onOpen: () => void;
  onEvent: (event: SSEMigrationEvent) => void;
  onPlanChange: (change: SSEPlanChange) => void;
  /** `permanent` is true when the browser gave up reconnecting (e.g. 404 from an older server). */
  onError: (permanent: boolean) => void;
}

/** Whether the runtime can open an SSE connection at all. */
export function isEventStreamSupported(): boolean {
  return typeof EventSource !== 'undefined';
}

function parse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Opens an EventSource against the SSE migration stream.
 * Returns a cleanup function that closes the connection.
 */
export function connectMigrationStream(callbacks: MigrationStreamCallbacks): () => void {
  const source = new EventSource(`${API_BASE}/api/events/stream`);

  source.onopen = () => callbacks.onOpen();

  source.addEventListener('migration', (e: MessageEvent<string>) => {
    const event = parse<SSEMigrationEvent>(e.data);
    if (event) callbacks.onEvent(event);
  });

  source.addEventListener('plan', (e: MessageEvent<string>) => {
    const change = parse<SSEPlanChange>(e.data);
    if (change) callbacks.onPlanChange(change);
  });

  source.onerror = () => {
    callbacks.onError(source.readyState === EventSource.CLOSED);
  };

  return () => source.close();
}
