import type { Response } from 'express';

const HEARTBEAT_INTERVAL_MS = 15_000;

/** Why the plan list changed; lets the dashboard decide how much to re-fetch. */
export type PlanChangeReason = 'saved' | 'task' | 'reset';

/**
 * Server-Sent Events broadcaster for migration activity.
 * Infrastructure concern only: fans out state changes to SSE clients
 * connected via GET /api/events/stream. Sends a comment heartbeat while
 * clients are connected so idle connections are not dropped by proxies.
 */
export class MigrationEventStream {
  private readonly clients = new Set<Response>();
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(private readonly heartbeatIntervalMs: number = HEARTBEAT_INTERVAL_MS) {}

  /**
   * Register a new SSE client connection.
   * Sets the stream headers and removes the client on disconnect.
   */
  addClient(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    this.clients.add(res);
    this.startHeartbeat();

    const remove = () => this.removeClient(res);
    res.on('close', remove);
    // A write to a half-closed socket surfaces here; without a listener Node would throw.
    res.on('error', remove);

    this.write(res, 'retry: 3000\n\n');
  }

  /**
   * Broadcast a persisted semantic event. Maps to the SSE `migration` event
   * so clients can subscribe selectively via EventSource.addEventListener().
   */
  broadcastEvent(eventName: string, payload: Record<string, unknown>): void {
    this.send('migration', { eventName, payload, timestamp: new Date().toISOString() });
  }

  /**
   * Broadcast that the plan list changed (plan saved, task status updated, state reset).
   * Separate `plan` event so the dashboard can re-fetch plans without re-fetching events.
   */
  broadcastPlanChange(reason: PlanChangeReason, planId?: string): void {
    this.send('plan', { reason, planId: planId ?? null });
  }

  /** Number of currently connected clients. */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Whether the keep-alive heartbeat timer is running. */
  get isHeartbeatActive(): boolean {
    return this.heartbeat !== null;
  }

  /** Disconnect all clients (used during server shutdown). */
  close(): void {
    this.stopHeartbeat();
    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();
  }

  private send(event: string, data: unknown): void {
    this.writeAll(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private writeAll(chunk: string): void {
    for (const client of this.clients) {
      this.write(client, chunk);
    }
  }

  /** Write to one client, evicting it if the connection is already gone. */
  private write(client: Response, chunk: string): void {
    if (client.destroyed || client.writableEnded) {
      this.removeClient(client);
      return;
    }
    try {
      client.write(chunk);
    } catch {
      this.removeClient(client);
    }
  }

  private removeClient(client: Response): void {
    this.clients.delete(client);
    if (this.clients.size === 0) this.stopHeartbeat();
  }

  private startHeartbeat(): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => this.writeAll(': heartbeat\n\n'), this.heartbeatIntervalMs);
    // Never keep the process alive just for idle SSE clients.
    this.heartbeat.unref();
  }

  private stopHeartbeat(): void {
    if (!this.heartbeat) return;
    clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
}
