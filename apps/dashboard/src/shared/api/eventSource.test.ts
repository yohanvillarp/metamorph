import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from '@/shared/testing/fakeEventSource';
import { connectMigrationStream, isEventStreamSupported, type MigrationStreamCallbacks } from './eventSource';

function callbacks(): MigrationStreamCallbacks {
  return { onOpen: vi.fn(), onEvent: vi.fn(), onPlanChange: vi.fn(), onError: vi.fn() };
}

describe('isEventStreamSupported', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is false when the runtime has no EventSource', () => {
    vi.stubGlobal('EventSource', undefined);
    expect(isEventStreamSupported()).toBe(false);
  });

  it('is true when EventSource exists', () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    expect(isEventStreamSupported()).toBe(true);
  });
});

describe('connectMigrationStream', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    vi.stubGlobal('EventSource', FakeEventSource);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens the stream endpoint and reports open', () => {
    const cb = callbacks();
    connectMigrationStream(cb);
    expect(FakeEventSource.latest.url).toBe('/api/events/stream');
    FakeEventSource.latest.open();
    expect(cb.onOpen).toHaveBeenCalledTimes(1);
  });

  it('parses migration and plan frames into typed callbacks', () => {
    const cb = callbacks();
    connectMigrationStream(cb);
    const event = { eventName: 'worker.started', payload: { filePath: 'src/a.ts' }, timestamp: '2026-10-28T00:00:00.000Z' };
    FakeEventSource.latest.emit('migration', JSON.stringify(event));
    FakeEventSource.latest.emit('plan', JSON.stringify({ reason: 'task', planId: 'plan-1' }));
    expect(cb.onEvent).toHaveBeenCalledWith(event);
    expect(cb.onPlanChange).toHaveBeenCalledWith({ reason: 'task', planId: 'plan-1' });
  });

  it('ignores malformed payloads instead of throwing from the listener', () => {
    const cb = callbacks();
    connectMigrationStream(cb);
    expect(() => FakeEventSource.latest.emit('migration', '{not json')).not.toThrow();
    expect(() => FakeEventSource.latest.emit('plan', '')).not.toThrow();
    expect(cb.onEvent).not.toHaveBeenCalled();
    expect(cb.onPlanChange).not.toHaveBeenCalled();
  });

  it('flags errors as permanent only once the browser stopped reconnecting', () => {
    const cb = callbacks();
    connectMigrationStream(cb);
    FakeEventSource.latest.fail(false);
    expect(cb.onError).toHaveBeenLastCalledWith(false);
    FakeEventSource.latest.fail(true);
    expect(cb.onError).toHaveBeenLastCalledWith(true);
  });

  it('returns a disposer that closes the connection', () => {
    const disconnect = connectMigrationStream(callbacks());
    disconnect();
    expect(FakeEventSource.latest.closed).toBe(true);
  });
});
