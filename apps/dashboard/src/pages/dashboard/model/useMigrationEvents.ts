import { useState, useEffect, useRef, useCallback } from 'react';
import type { MigrationPlan, MigrationEventItem } from '@/entities/migration';
import { apiClient } from '@/shared/api/apiClient';
import {
  connectMigrationStream,
  isEventStreamSupported,
  type SSEMigrationEvent,
} from '@/shared/api/eventSource';

/** Fallback cadence while the stream is unsupported, connecting, or dropped. */
export const POLL_INTERVAL_MS = 1000;
/**
 * Slow re-sync while streaming. `metamorph run`/`apply`/`reset` in another
 * terminal write to SQLite out of process, so their changes never reach the
 * UI server's stream; this catches them without the old 1s hammering.
 */
export const RECONCILE_INTERVAL_MS = 10_000;
export const PLAN_REFRESH_THROTTLE_MS = 250;
export const MAX_EVENTS = 2000;
export const OFFLINE_AFTER_FAILURES = 3;

function appendEvent(events: MigrationEventItem[], event: SSEMigrationEvent): MigrationEventItem[] {
  // Hydration leaves events oldest-first; a streamed one belongs at the end.
  // The store assigns ids sequentially, so the next id follows the newest we
  // hold until the next hydration replaces it with the persisted row.
  const newest = events[events.length - 1];
  const id = newest ? newest.id + 1 : 1;
  return [...events, { ...event, id }].slice(-MAX_EVENTS);
}

/** Interval polling whose cadence can be switched; start/stop are idempotent. */
function usePolling(tick: () => void) {
  const timerRef = useRef<{ id: ReturnType<typeof setInterval>; intervalMs: number } | null>(null);
  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current.id);
    timerRef.current = null;
  }, []);
  const start = useCallback((intervalMs: number) => {
    if (timerRef.current?.intervalMs === intervalMs) return;
    stop();
    timerRef.current = { id: setInterval(tick, intervalMs), intervalMs };
  }, [tick, stop]);
  return { start, stop };
}

/** Coalesces bursts of plan/task changes into a single plans re-fetch. */
function useThrottledPlanRefresh(setPlans: (plans: MigrationPlan[]) => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPlans = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      try {
        setPlans(await apiClient.getPlans());
      } catch (error) {
        console.error('Error refreshing plans:', error);
      }
    }, PLAN_REFRESH_THROTTLE_MS);
  }, [setPlans]);
  const cancelPlanRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);
  return { refreshPlans, cancelPlanRefresh };
}

/**
 * Feeds plans and events to the dashboard. Hydrates once over REST, then
 * subscribes to the SSE stream and only re-syncs slowly; 1s polling is used
 * solely while the stream is unavailable (unsupported, connecting, or dropped).
 */
export function useMigrationEvents() {
  const [plans, setPlans] = useState<MigrationPlan[]>([]);
  const [events, setEvents] = useState<MigrationEventItem[]>([]);
  const [isServerOffline, setIsServerOffline] = useState(false);

  const consecutiveFailuresRef = useRef(0);

  const markOnline = useCallback(() => {
    consecutiveFailuresRef.current = 0;
    setIsServerOffline(false);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [plansData, eventsData] = await Promise.all([
        apiClient.getPlans(),
        apiClient.getEvents(),
      ]);
      setPlans(plansData);
      setEvents(eventsData.reverse());
      markOnline();
    } catch (error) {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= OFFLINE_AFTER_FAILURES) {
        setIsServerOffline(true);
      }
      console.error('Error fetching dashboard data:', error);
    }
  }, [markOnline]);

  const { start: startPolling, stop: stopPolling } = usePolling(fetchData);
  const { refreshPlans, cancelPlanRefresh } = useThrottledPlanRefresh(setPlans);

  useEffect(() => {
    fetchData();

    if (!isEventStreamSupported()) {
      startPolling(POLL_INTERVAL_MS);
      return stopPolling;
    }

    // Poll until the stream is confirmed open; the browser retries transient drops itself.
    let wasInterrupted = false;
    startPolling(POLL_INTERVAL_MS);
    const disconnect = connectMigrationStream({
      onOpen: () => {
        startPolling(RECONCILE_INTERVAL_MS);
        markOnline();
        // Catch up on anything persisted while the stream was down.
        if (wasInterrupted) fetchData();
      },
      onEvent: (event) => setEvents((prev) => appendEvent(prev, event)),
      onPlanChange: (change) => {
        if (change.reason === 'reset') fetchData();
        else refreshPlans();
      },
      onError: () => {
        wasInterrupted = true;
        startPolling(POLL_INTERVAL_MS);
      },
    });

    return () => {
      disconnect();
      stopPolling();
      cancelPlanRefresh();
    };
  }, [fetchData, startPolling, stopPolling, refreshPlans, cancelPlanRefresh, markOnline]);

  return { plans, events, isServerOffline, fetchData };
}
