import type { MigrationPlan, Tab } from '@/entities/migration';
import { SWARM_AGENTS, classifySwarmAgent, type SwarmAgentId } from '@/entities/migration/agents';
import { useAlertStore } from '@/shared/store/alertStore';
import { EventLog } from '@/widgets/event-log/EventLog';
import { MigrationForm } from '@/widgets/migration-form/MigrationForm';
import { AgentRoster } from '@/widgets/overview/AgentRoster';
import { OverviewStats } from '@/widgets/overview/OverviewStats';
import { MigrationQueue } from '@/widgets/queue/MigrationQueue';
import { LiveSwarm } from '@/widgets/swarm-view/LiveSwarm';
import { Cpu, HardDrive, LayoutDashboard, Radio, Bug, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NextStepsViewer } from './NextStepsViewer';

const API_BASE = '';
const GITHUB_REPO = 'https://github.com/yohanvillarp/metamorph';
const TABS: Tab[] = ['overview', 'swarm', 'queue', 'events'];

function tabFromHash(): Tab {
  const value = window.location.hash.replace(/^#/, '').toLowerCase();
  return (TABS as string[]).includes(value) ? (value as Tab) : 'overview';
}

export const DashboardPage = () => {
  const [plans, setPlans] = useState<MigrationPlan[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>(tabFromHash);

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
  
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [isApplying, setIsApplying] = useState(false);
  const [appliedRunId, setAppliedRunId] = useState<string | null>(null);
  const [lastApply, setLastApply] = useState<{ gitUsed: boolean; branch?: string; message: string } | null>(null);

  const fetchData = async () => {
    try {
      const [plansRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/api/plans`),
        fetch(`${API_BASE}/api/events`)
      ]);
      const plansData = await plansRes.json();
      const eventsData = await eventsRes.json();
      setPlans(plansData);
      setEvents(eventsData.reverse());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleResetMigration = async () => {
    try {
      await fetch(`${API_BASE}/api/migrations/reset`, {
        method: 'POST',
      });
      setAppliedRunId(null);
      setLastApply(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  const { showAlert, showConfirm } = useAlertStore();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('preview') !== 'integration') return;
    showAlert(
      'Integration Successful',
      <NextStepsViewer
        message="Migration applied to your project. A git branch was created with the migrated files."
        gitUsed
        branch="metamorph/react-to-next-a1b2"
        targetPath="C:\\Users\\yohan\\myspace\\lab\\active\\metamorph\\scratch\\playgrounds\\react-app"
      />
    );
  }, [showAlert]);

  const handleApplyMigration = async () => {
    if (!latestPlan) return;
    
    showConfirm(
      'Apply Migration?',
      <p>This will copy the migrated files from the shadow workspace into your project directory. Your original project has NOT been modified until this point. After applying, you will need to run <code className="font-mono bg-gray-200 px-1">npm install</code> to install the new dependencies.</p>,
      async () => {
        setIsApplying(true);
        try {
          const res = await fetch(`${API_BASE}/api/migrations/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              runId: latestPlan.runId,
              targetPath: latestPlan.targetPath 
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setAppliedRunId(latestPlan.runId);
          setLastApply({ gitUsed: data.gitUsed, branch: data.branch, message: data.message });
          await fetchData();
          showAlert(
            'Applied',
            <NextStepsViewer 
              message={data.message}
              gitUsed={data.gitUsed}
              branch={data.branch}
              targetPath={latestPlan.targetPath}
            />
          );
        } catch (err: any) {
          showAlert('Apply Failed', <p className="text-red-500 font-bold">{err.message}</p>);
        } finally {
          setIsApplying(false);
        }
      }
    );
  };

  const handleDiscardMigration = async () => {
    if (!latestPlan) return;
    
    showConfirm(
      'Discard Migration?',
      <p>This will permanently delete the Shadow Workspace for this run. Are you sure?</p>,
      async () => {
        try {
          await fetch(`${API_BASE}/api/migrations/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ runId: latestPlan.runId })
          });
          handleResetMigration();
        } catch (err: any) {
          showAlert('Discard Failed', <p className="text-red-500">{err.message}</p>);
        }
      }
    );
  };

  const handleStartMigration = async (targetPath: string, fromFw: string, toFw: string) => {
    if (!targetPath) {
      setStartError('Please select a target directory first.');
      return;
    }
    
    setIsStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`${API_BASE}/api/migrations/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromFw,
          to: toFw,
          targetPath
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start migration');
      }

      await fetchData();
    } catch (err: any) {
      setStartError(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  // Plans are ordered by created_at DESC, so plans[0] is the newest
  const latestPlan = plans.length > 0 ? plans[0] : null;

  // Overview Stats
  const pendingTasks = latestPlan?.tasks?.filter((t: any) => t.status === 'pending').length || 0;
  const inProgressTasks = latestPlan?.tasks?.filter((t: any) => t.status === 'in_progress').length || 0;
  const completedTasks = latestPlan?.tasks?.filter((t: any) => t.status === 'completed').length || 0;
  const failedTasks = latestPlan?.tasks?.filter((t: any) => t.status === 'failed').length || 0;

  const isFailed = latestPlan?.phase === 'failed';
  const isFinished = latestPlan?.phase === 'completed' || isFailed;
  const isIntegrating = !isFinished && latestPlan?.phase === 'integration';

  const currentRunEvents = useMemo(() => {
    if (!latestPlan) return [];
    const startedAt = new Date(latestPlan.createdAt).getTime();
    return events.filter(e => new Date(e.timestamp).getTime() >= startedAt);
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

  const isApplied = Boolean(latestPlan?.appliedAt || latestPlan?.appliedBranch)
    || (latestPlan != null && appliedRunId === latestPlan.runId)
    || currentRunEvents.some((e) => String(e.eventName ?? '').toLowerCase().includes('migration.applied'));

  const notifiedRunId = useRef<string | null>(null);

  useEffect(() => {
    if (!isFinished || isApplied || !latestPlan) return;
    if (notifiedRunId.current === latestPlan.runId) return;
    notifiedRunId.current = latestPlan.runId;
    showAlert(
      isFailed ? 'Run finished with errors' : 'Ready to apply',
      <div className="space-y-4 text-center">
        <p>{isFailed
          ? 'The swarm stopped because the shadow npm run build (or catalog checks) still failed. Apply is available if you want the partial result; prefer a new run after checking the queue and events.'
          : 'The swarm finished. Apply copies files (including MIGRATION.md) onto a git branch. Discard drops the shadow run.'}</p>
        {!isFailed && <p className="font-bold">Apply only once. After that you will see next-step commands, not Apply again.</p>}
      </div>
    );
  }, [isFinished, isFailed, isApplied, latestPlan, showAlert]);

  // Same run + same event vocabulary as Live Swarm so bars grow with the flow
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

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col min-h-screen">
      {latestPlan ? (
        <>
          <header className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-8 pb-4 border-b-4 border-neo-border">
            <a href={GITHUB_REPO} target="_blank" rel="noreferrer" title="Metamorph on GitHub" className="flex items-center gap-3 hover:opacity-80">
              <img src="/logo_metamorph.png" alt="" className="h-12 w-12 border-2 border-neo-border bg-white object-contain" />
              <div>
                <h1 className="text-3xl font-black uppercase tracking-widest flex items-center gap-2">
                  Metamorph
                </h1>
                <p className="text-sm font-bold text-neo-text/60 uppercase tracking-widest mt-1">
                  AI-Powered Migration Swarm
                </p>
              </div>
            </a>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {isFinished && !isApplied && (
                <div className="flex flex-wrap items-center gap-2 border-r-2 border-neo-border pr-4 md:pr-6">
                  <button 
                    onClick={handleApplyMigration}
                    disabled={isApplying}
                    className="bg-green-400 font-black text-sm uppercase px-4 py-2 border-2 border-neo-border hover:bg-green-500 transition-colors shadow-[4px_4px_0px_0px_var(--neo-text)] active:translate-y-1 active:translate-x-1 active:shadow-none"
                  >
                    {isApplying ? 'Applying...' : 'Apply Migration'}
                  </button>
                  <button 
                    onClick={handleDiscardMigration}
                    className="bg-red-400 font-black text-sm uppercase px-4 py-2 border-2 border-neo-border hover:bg-red-500 transition-colors text-white active:translate-y-1 active:translate-x-1 active:shadow-none"
                  >
                    Discard
                  </button>
                </div>
              )}
              {isApplied && (
                <button
                  type="button"
                  onClick={() => showAlert(
                    'Next steps',
                    <NextStepsViewer
                      message={lastApply?.message || 'This migration is already applied. Checkout the branch and run npm install / npm run dev.'}
                      gitUsed={lastApply?.gitUsed ?? Boolean(latestPlan.appliedBranch)}
                      branch={lastApply?.branch || latestPlan.appliedBranch}
                      targetPath={latestPlan.targetPath}
                    />
                  )}
                  className="neo-btn font-black text-sm uppercase px-4 py-2"
                >
                  Next steps
                </button>
              )}
              <button 
                onClick={handleResetMigration}
                className="neo-btn font-black text-sm uppercase px-4 py-2 flex items-center gap-2 hover:bg-neo-primary hover:text-neo-bg transition-colors"
              >
                <Plus size={16} strokeWidth={3} /> New Migration
              </button>
              <a 
                href={GITHUB_REPO}
                target="_blank"
                rel="noreferrer"
                title="GitHub repository"
                className="neo-btn p-2 flex items-center justify-center hover:bg-neo-primary hover:text-neo-bg transition-colors"
              >
                <img src="/github.svg" alt="GitHub" className="h-5 w-5" />
              </a>
              <a 
                href={`${GITHUB_REPO}/discussions/new?category=q-a`}
                target="_blank"
                rel="noreferrer"
                className="neo-btn font-black text-sm uppercase px-4 py-2 flex items-center gap-2 hover:bg-yellow-300 hover:text-black transition-colors"
              >
                <Bug size={16} /> Report Issue
              </a>
            </div>
          </header>

          {!isFinished && (
            <div className="mb-6 p-4 border-4 border-neo-border bg-yellow-300 text-black">
              <p className="font-black uppercase tracking-widest text-sm mb-1">
                {isIntegrating ? 'Not done — installing dependencies' : 'Swarm is still working'}
              </p>
              <p className="font-bold text-sm leading-relaxed">
                {isIntegrating
                  ? (latestStatusMessage || 'IntegrationAgent is running npm install and npm run build in the shadow workspace. File counters can sit at 0. Wait for Apply Migration.')
                  : (latestStatusMessage || 'Mapper, Worker, Reviewer, Integration, and Reporter are on the bus. Watch Live Swarm and the queue, not only the Completed count.')}
              </p>
            </div>
          )}
          {isFinished && !isApplied && (
            <div className={`mb-6 p-4 border-4 border-neo-border text-black ${isFailed ? 'bg-red-400' : 'bg-green-400'}`}>
              <p className="font-black uppercase tracking-widest text-sm mb-1">
                {isFailed ? 'Build did not pass' : 'Ready to apply'}
              </p>
              <p className="font-bold text-sm leading-relaxed">
                {isFailed
                  ? 'Shadow npm install / npm run build (or catalog checks) failed after repair rounds. The queue should have shown the reopened files. Apply still copies the shadow if you want it; otherwise start a new migration.'
                  : 'Apply copies the shadow result into your repo on a git branch (including MIGRATION.md). Discard deletes the shadow run. Apply is one-shot.'}
              </p>
            </div>
          )}
          {isApplied && (
            <div className="mb-6 p-4 border-4 border-neo-border bg-green-400 text-black">
              <p className="font-black uppercase tracking-widest text-sm mb-1">Applied</p>
              <p className="font-bold text-sm leading-relaxed">
                This run is already in your project{latestPlan.appliedBranch || lastApply?.branch ? ` on branch ${latestPlan.appliedBranch || lastApply?.branch}` : ''}. Applying again would redo the same git checkout. Start a new migration, or open Next steps for install commands.
              </p>
            </div>
          )}

          {/* TAB NAVIGATION */}
          <nav className="flex flex-wrap gap-4 border-b-2 border-neo-border pb-4">
            <button 
              onClick={() => selectTab('overview')}
              className={`neo-btn flex items-center gap-2 ${activeTab === 'overview' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
            >
              <LayoutDashboard size={18}/> Overview
            </button>
            <button 
              onClick={() => selectTab('swarm')}
              className={`neo-btn flex items-center gap-2 ${activeTab === 'swarm' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
            >
              <Cpu size={18}/> Live Swarm
            </button>
            <button 
              onClick={() => selectTab('queue')}
              className={`neo-btn flex items-center gap-2 ${activeTab === 'queue' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
            >
              <HardDrive size={18}/> Queue
            </button>
            <button 
              onClick={() => selectTab('events')}
              className={`neo-btn flex items-center gap-2 ${activeTab === 'events' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
            >
              <Radio size={18}/> Event Log
            </button>
          </nav>

          {/* TAB CONTENT */}
          <main className="flex-1 mt-6">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <AgentRoster counts={agentCounts} activeAgent={activeAgent} />
                <OverviewStats 
                  pendingTasks={pendingTasks} 
                  inProgressTasks={inProgressTasks} 
                  completedTasks={completedTasks} 
                  failedTasks={failedTasks} 
                  chartData={chartData}
                  isIntegrating={isIntegrating}
                />
              </div>
            )}

            {activeTab === 'swarm' && (
              <LiveSwarm
                events={currentRunEvents}
                tasks={latestPlan.tasks || []}
                activeAgent={activeAgent}
                isIntegrating={isIntegrating}
                isFinished={isFinished}
                latestStatus={latestStatusMessage}
              />
            )}

            {activeTab === 'queue' && (
              <MigrationQueue tasks={latestPlan.tasks || []} />
            )}

            {activeTab === 'events' && (
              <EventLog events={currentRunEvents} />
            )}
          </main>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-6">
          <MigrationForm 
            onStart={handleStartMigration} 
            isStarting={isStarting} 
            startError={startError} 
          />
        </div>
      )}
    </div>
  );
};
