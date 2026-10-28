import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MigrationEventItem, MigrationPlan } from '@/entities/migration';
import { apiClient } from '@/shared/api/apiClient';
import { FakeEventSource } from '@/shared/testing/fakeEventSource';
import { POLL_INTERVAL_MS, RECONCILE_INTERVAL_MS, PLAN_REFRESH_THROTTLE_MS, useMigrationEvents } from './useMigrationEvents';

vi.mock('@/shared/api/apiClient', () => ({
  apiClient: { getPlans: vi.fn(), getEvents: vi.fn() },
}));

const api = vi.mocked(apiClient);
const plan = { id: 'plan-1', runId: 'run-1' } as MigrationPlan;
const stored: MigrationEventItem[] = [
  { id: 2, eventName: 'worker.started', timestamp: '2026-10-28T00:00:01.000Z' },
  { id: 1, eventName: 'migration.started', timestamp: '2026-10-28T00:00:00.000Z' },
];

const flush = () => act(async () => {});
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  api.getPlans.mockResolvedValue([plan]);
  api.getEvents.mockResolvedValue([...stored]);
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useMigrationEvents hydration', () => {
  it('hydrates once over REST and keeps events oldest-first', async () => {
    const { result } = renderHook(() => useMigrationEvents());
    await flush();
    expect(api.getPlans).toHaveBeenCalledTimes(1);
    expect(api.getEvents).toHaveBeenCalledTimes(1);
    expect(result.current.plans).toEqual([plan]);
    expect(result.current.events.map((e) => e.id)).toEqual([1, 2]);
    expect(result.current.isServerOffline).toBe(false);
  });

  it('reports the server offline after three consecutive failures and recovers on success', async () => {
    vi.stubGlobal('EventSource', undefined);
    api.getPlans.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useMigrationEvents());
    await flush();
    await advance(POLL_INTERVAL_MS);
    expect(result.current.isServerOffline).toBe(false);
    await advance(POLL_INTERVAL_MS);
    expect(result.current.isServerOffline).toBe(true);

    api.getPlans.mockResolvedValue([plan]);
    await advance(POLL_INTERVAL_MS);
    expect(result.current.isServerOffline).toBe(false);
  });
});

describe('useMigrationEvents without EventSource', () => {
  it('falls back to 1s polling and stops on unmount', async () => {
    vi.stubGlobal('EventSource', undefined);
    const { unmount } = renderHook(() => useMigrationEvents());
    await flush();
    await advance(POLL_INTERVAL_MS * 3);
    expect(api.getPlans).toHaveBeenCalledTimes(4);
    expect(FakeEventSource.instances).toHaveLength(0);

    unmount();
    await advance(POLL_INTERVAL_MS * 3);
    expect(api.getPlans).toHaveBeenCalledTimes(4);
  });
});

describe('useMigrationEvents streaming', () => {
  it('polls until the stream opens, then only re-syncs slowly', async () => {
    renderHook(() => useMigrationEvents());
    await flush();
    await advance(POLL_INTERVAL_MS);
    expect(api.getPlans).toHaveBeenCalledTimes(2);

    act(() => FakeEventSource.latest.open());
    await advance(POLL_INTERVAL_MS * 5);
    expect(api.getPlans).toHaveBeenCalledTimes(2);
    await advance(RECONCILE_INTERVAL_MS);
    expect(api.getPlans).toHaveBeenCalledTimes(3);
    expect(api.getEvents).toHaveBeenCalledTimes(3);
  });

  it('appends streamed events after the newest with the next id', async () => {
    const { result } = renderHook(() => useMigrationEvents());
    await flush();
    act(() => FakeEventSource.latest.open());
    act(() => FakeEventSource.latest.emit('migration', JSON.stringify({ eventName: 'worker.completed', payload: {}, timestamp: 't' })));
    expect(result.current.events.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(result.current.events[2].eventName).toBe('worker.completed');
  });

  it('coalesces a burst of plan changes into one plans re-fetch', async () => {
    renderHook(() => useMigrationEvents());
    await flush();
    act(() => FakeEventSource.latest.open());
    for (let i = 0; i < 5; i += 1) {
      act(() => FakeEventSource.latest.emit('plan', JSON.stringify({ reason: 'task', planId: 'plan-1' })));
    }
    expect(api.getPlans).toHaveBeenCalledTimes(1);
    await advance(PLAN_REFRESH_THROTTLE_MS);
    expect(api.getPlans).toHaveBeenCalledTimes(2);
    expect(api.getEvents).toHaveBeenCalledTimes(1);
  });

  it('re-hydrates everything on reset', async () => {
    renderHook(() => useMigrationEvents());
    await flush();
    act(() => FakeEventSource.latest.open());
    act(() => FakeEventSource.latest.emit('plan', JSON.stringify({ reason: 'reset', planId: null })));
    await flush();
    expect(api.getEvents).toHaveBeenCalledTimes(2);
  });

  it('polls while the stream is down and catches up once it reopens', async () => {
    renderHook(() => useMigrationEvents());
    await flush();
    act(() => FakeEventSource.latest.open());
    act(() => FakeEventSource.latest.fail());
    await advance(POLL_INTERVAL_MS * 2);
    expect(api.getPlans).toHaveBeenCalledTimes(3);

    act(() => FakeEventSource.latest.open());
    await flush();
    expect(api.getPlans).toHaveBeenCalledTimes(4);
    await advance(POLL_INTERVAL_MS * 3);
    expect(api.getPlans).toHaveBeenCalledTimes(4);
  });

  it('closes the stream and clears timers on unmount', async () => {
    const { unmount } = renderHook(() => useMigrationEvents());
    await flush();
    act(() => FakeEventSource.latest.open());
    act(() => FakeEventSource.latest.emit('plan', JSON.stringify({ reason: 'saved', planId: 'plan-1' })));
    unmount();
    expect(FakeEventSource.latest.closed).toBe(true);
    await advance(RECONCILE_INTERVAL_MS + PLAN_REFRESH_THROTTLE_MS);
    expect(api.getPlans).toHaveBeenCalledTimes(1);
  });
});
