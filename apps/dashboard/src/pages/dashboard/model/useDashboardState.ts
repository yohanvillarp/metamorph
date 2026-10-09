import { useState, useEffect, useMemo, useRef } from 'react';
import type { MigrationPlan, Tab, TaskItem, MigrationEventItem } from '@/entities/migration';
import { SWARM_AGENTS, classifySwarmAgent, type SwarmAgentId } from '@/entities/migration/agents';
import { apiClient } from '@/shared/api/apiClient';

export const TABS: Tab[] = ['overview', 'swarm', 'queue', 'events'];

export function tabFromHash(): Tab {
  const value = window.location.hash.replace(/^#/, '').toLowerCase();
  return (TABS as string[]).includes(value) ? (value as Tab) : 'overview';
}

export function useDashboardState() {
  const [plans, setPlans] = useState<MigrationPlan[]>([]);
  const [events, setEvents] = useState<MigrationEventItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>(tabFromHash);

  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [isApplying, setIsApplying] = useState(false);
  const [appliedRunId, setAppliedRunId] = useState<string | null>(null);
  const [lastApply, setLastApply] = useState<{ gitUsed: boolean; branch?: string; message: string } | null>(null);

  const [isServerOffline, setIsServerOffline] = useState(false);
  const consecutiveFailuresRef = useRef(0);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    if (window.location.hash.replace(/^#/, '') !== tab) {
      window.location.hash = tab;
    }
  };

  useEffect(() => {
    const onHash = () => setActiveTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) {
      window.location.hash = tabFromHash();
    }
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const fetchData = async () => {
    try {
      const [plansData, eventsData] = await Promise.all([
        apiClient.getPlans(),
        apiClient.getEvents(),
      ]);
      setPlans(plansData);
      setEvents(eventsData.reverse());
      consecutiveFailuresRef.current = 0;
      setIsServerOffline(false);
    } catch (error) {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 3) {
        setIsServerOffline(true);
      }
      console.error('Error fetching dashboard data:', error);
    }
  };

  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    const clockInterval = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, []);

  const latestPlan = plans.length > 0 ? plans[0] : null;

  const currentRunEvents = useMemo(() => {
    if (!latestPlan) return [];
    const startedAt = new Date(latestPlan.createdAt).getTime();
    return events.filter((e) => new Date(e.timestamp).getTime() >= startedAt);
  }, [events, latestPlan]);

  const latestStatusMessage = useMemo(() => {
    for (const evt of currentRunEvents) {
      const name = String(evt.eventName ?? '').toLowerCase();
      if (name.includes('system.log') || name.includes('system_log')) {
        const message = evt.payload?.message;
        if (typeof message === 'string' && message.trim()) return message;
      }
    }
    return null;
  }, [currentRunEvents]);

  const isFailed = latestPlan?.phase === 'failed' || latestPlan?.outcome === 'failed';
  const isSuccess = latestPlan?.phase === 'completed' && latestPlan?.outcome === 'success';
  const isFinished = isSuccess || isFailed;
  const isIntegrating = !isFinished && latestPlan?.phase === 'integration';

  const isApplied = Boolean(latestPlan?.appliedAt || latestPlan?.appliedBranch)
    || (latestPlan != null && appliedRunId === latestPlan.runId)
    || currentRunEvents.some((e) => String(e.eventName ?? '').toLowerCase().includes('migration.applied'));

  const canApply = Boolean(isSuccess && !isApplied);

  const pendingTasks = latestPlan?.tasks?.filter((t: TaskItem) => t.status === 'pending').length || 0;
  const inProgressTasks = latestPlan?.tasks?.filter((t: TaskItem) => t.status === 'in_progress').length || 0;
  const completedTasks = latestPlan?.tasks?.filter((t: TaskItem) => t.status === 'completed').length || 0;
  const failedTasks = latestPlan?.tasks?.filter((t: TaskItem) => t.status === 'failed').length || 0;

  const lastActivityTimestamp = useMemo(() => {
    let maxTime = latestPlan ? new Date(latestPlan.createdAt).getTime() : 0;
    for (const evt of currentRunEvents) {
      const t = new Date(evt.timestamp).getTime();
      if (t > maxTime) maxTime = t;
    }
    return maxTime;
  }, [currentRunEvents, latestPlan]);

  // If no events for 45s and migration is not completed/failed, treat as stalled/inactive
  const STALL_THRESHOLD_MS = 45_000;
  const isStalled = Boolean(
    !isFinished &&
    latestPlan &&
    lastActivityTimestamp > 0 &&
    (currentTime - lastActivityTimestamp > STALL_THRESHOLD_MS)
  );

  const stalledDurationSeconds = isStalled
    ? Math.max(0, Math.floor((currentTime - lastActivityTimestamp) / 1000))
    : 0;

  const chartData = useMemo(() => {
    const counts = Object.fromEntries(SWARM_AGENTS.map((agent) => [agent.id, 0])) as Record<SwarmAgentId, number>;
    for (const event of currentRunEvents) {
      const agent = classifySwarmAgent(event.eventName, event.payload);
      if (agent) counts[agent] += 1;
    }
    return SWARM_AGENTS.map((agent) => ({
      name: agent.id,
      events: counts[agent.id],
      color: agent.color,
    }));
  }, [currentRunEvents]);

  const agentCounts = useMemo(() => {
    return Object.fromEntries(chartData.map((row) => [row.name, row.events])) as Record<SwarmAgentId, number>;
  }, [chartData]);

  const reporterBusy = /reporter is writing/i.test(latestStatusMessage || '');
  const activeAgent: SwarmAgentId | null = reporterBusy
    ? 'Reporter'
    : isIntegrating
      ? 'Integration'
      : (inProgressTasks > 0 ? 'Worker' : null);

  const handleResetMigration = async () => {
    try {
      await apiClient.resetMigration();
      setAppliedRunId(null);
      setLastApply(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  const handleStartMigration = async (targetPath: string, fromFw: string, toFw: string) => {
    if (!targetPath) {
      setStartError('Please select a target directory first.');
      return;
    }
    setIsStarting(true);
    setStartError(null);
    try {
      await apiClient.startMigration({ from: fromFw, to: toFw, targetPath });
      await fetchData();
    } catch (err: unknown) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStarting(false);
    }
  };

  const disabledAgents = useMemo(() => {
    for (const evt of currentRunEvents) {
      if (Array.isArray(evt.payload?.disabledAgents)) {
        return evt.payload.disabledAgents as string[];
      }
      const msg = String(evt.payload?.message ?? '');
      const match = msg.match(/disabled agents: ([^\n\r.]+)/i);
      if (match && match[1]) {
        return match[1].split(',').map((s) => s.replace(/\([^)]*\)/g, '').trim()).filter(Boolean);
      }
    }
    return [];
  }, [currentRunEvents]);

  return {
    plans,
    latestPlan,
    events,
    activeTab,
    selectTab,
    isStarting,
    startError,
    isApplying,
    setIsApplying,
    appliedRunId,
    setAppliedRunId,
    lastApply,
    setLastApply,
    fetchData,
    handleResetMigration,
    handleStartMigration,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    failedTasks,
    isFailed,
    isSuccess,
    isFinished,
    isIntegrating,
    isApplied,
    canApply,
    latestStatusMessage,
    chartData,
    agentCounts,
    activeAgent,
    disabledAgents,
    isStalled,
    stalledDurationSeconds,
    isServerOffline,
  };
}
