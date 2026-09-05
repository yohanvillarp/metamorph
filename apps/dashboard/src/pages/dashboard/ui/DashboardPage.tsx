import type { MigrationPlan, Tab } from '@/entities/migration';
import { useAlertStore } from '@/shared/store/alertStore';
import { EventLog } from '@/widgets/event-log/EventLog';
import { MigrationForm } from '@/widgets/migration-form/MigrationForm';
import { OverviewStats } from '@/widgets/overview/OverviewStats';
import { MigrationQueue } from '@/widgets/queue/MigrationQueue';
import { SwarmSwimlanes } from '@/widgets/swarm-view/SwarmSwimlanes';
import { Activity, Cpu, HardDrive, LayoutDashboard, Radio } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = 'http://localhost:3000';

export const DashboardPage = () => {
  const [plans, setPlans] = useState<MigrationPlan[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [isApplying, setIsApplying] = useState(false);

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
    } finally {
      setLoading(false);
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
      await fetchData();
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  const { showAlert, showConfirm } = useAlertStore();

  const handleApplyMigration = async () => {
    if (!latestPlan) return;
    
    showConfirm(
      'Apply Migration?',
      <p>Are you sure you want to integrate these changes? This will create a new Git branch and commit the migrated files to your repository.</p>,
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
          
          const branchMatch = data.message.match(/branch: (.*)/);
          const branch = branchMatch ? branchMatch[1] : 'metamorph/run_...';

          showAlert(
            'Integration Successful',
            <div className="space-y-4">
              <p>{data.message}</p>
              <p className="font-bold">Next steps:</p>
              <pre className="bg-neo-border p-4 font-mono text-sm text-neo-bg overflow-x-auto whitespace-pre rounded-sm">
{`cd ${latestPlan.targetPath}
git fetch
git checkout ${branch}
npm install`}
              </pre>
            </div>
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

  const totalTasks = latestPlan?.tasks?.length || 0;
  const isFinished = totalTasks > 0 && (completedTasks + failedTasks === totalTasks);

  useEffect(() => {
    if (isFinished && activeTab === 'swarm') {
      setActiveTab('overview');
    }
  }, [isFinished, activeTab]);

  // Chart Data
  const chartData = useMemo(() => {
    const defaultData = [
      { name: 'Reader', events: 0, color: 'var(--neo-text)' },
      { name: 'Worker', events: 0, color: '#3b82f6' }, // blue-500
      { name: 'Reviewer', events: 0, color: '#eab308' }, // yellow-500
      { name: 'System', events: 0, color: '#22c55e' } // green-500
    ];

    if (!events.length) return defaultData;

    const lastMinuteEvents = events.filter(e => 
      new Date().getTime() - new Date(e.timestamp).getTime() < 60000
    );

    const counts: Record<string, number> = {
      ReaderAgent: 0, WorkerAgent: 0, ReviewerAgent: 0, System: 0
    };

    lastMinuteEvents.forEach(e => {
      if (e.eventName === 'FILE_READ') counts.ReaderAgent++;
      else if (e.eventName === 'FILE_WRITTEN') counts.WorkerAgent++;
      else if (e.eventName === 'FILE_REVIEWED') counts.ReviewerAgent++;
      else counts.System++;
    });

    return [
      { name: 'Reader', events: counts.ReaderAgent, color: 'var(--neo-text)' },
      { name: 'Worker', events: counts.WorkerAgent, color: '#3b82f6' },
      { name: 'Reviewer', events: counts.ReviewerAgent, color: '#eab308' },
      { name: 'System', events: counts.System, color: '#22c55e' }
    ];
  }, [events]);

  const currentRunEvents = useMemo(() => {
    if (!latestPlan) return [];
    return events.filter(e => 
      new Date(e.timestamp).getTime() >= new Date(latestPlan.createdAt).getTime()
    );
  }, [events, latestPlan]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col min-h-screen">
      {latestPlan ? (
        <>
          <header className="flex justify-between items-center mb-8 pb-4 border-b-4 border-neo-border">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-widest flex items-center gap-2">
                &gt;_ METAMORPH
              </h1>
              <p className="text-sm font-bold text-neo-text/60 uppercase tracking-widest mt-1">
                AI-Powered Migration Swarm
              </p>
            </div>
            <div className="flex items-center gap-4">
              {isFinished && (
                <div className="flex items-center gap-2 mr-2 border-r-2 border-neo-border pr-6">
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
              <button 
                onClick={handleResetMigration}
                className="neo-btn font-black text-sm uppercase px-4 py-2 flex items-center gap-2 hover:bg-neo-primary hover:text-neo-bg transition-colors"
              >
                + New Migration
              </button>
              <div className={`font-black text-sm uppercase px-4 py-2 flex items-center gap-2 border-2 border-neo-border ${loading ? 'bg-yellow-300' : 'bg-green-400'}`}>
                <Activity size={18} /> {loading ? 'CONNECTING...' : 'LIVE'}
              </div>
            </div>
          </header>

          {/* TAB NAVIGATION */}
          <nav className="flex flex-wrap gap-4 border-b-2 border-neo-border pb-4">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`neo-btn flex items-center gap-2 ${activeTab === 'overview' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
            >
              <LayoutDashboard size={18}/> Overview
            </button>
            <button 
              onClick={() => setActiveTab('swarm')}
              className={`neo-btn flex items-center gap-2 ${activeTab === 'swarm' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
            >
              <Cpu size={18}/> Live Swarm
            </button>
            <button 
              onClick={() => setActiveTab('queue')}
              className={`neo-btn flex items-center gap-2 ${activeTab === 'queue' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
            >
              <HardDrive size={18}/> Queue
            </button>
            <button 
              onClick={() => setActiveTab('events')}
              className={`neo-btn flex items-center gap-2 ${activeTab === 'events' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
            >
              <Radio size={18}/> Event Log
            </button>
          </nav>

          {/* TAB CONTENT */}
          <main className="flex-1 mt-6">
            {activeTab === 'overview' && (
              <OverviewStats 
                pendingTasks={pendingTasks} 
                inProgressTasks={inProgressTasks} 
                completedTasks={completedTasks} 
                failedTasks={failedTasks} 
                chartData={chartData} 
              />
            )}

            {activeTab === 'swarm' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <SwarmSwimlanes events={currentRunEvents} />
              </div>
            )}

            {activeTab === 'queue' && (
              <MigrationQueue tasks={latestPlan.tasks || []} />
            )}

            {activeTab === 'events' && (
              <EventLog events={events} />
            )}
          </main>
        </>
      ) : (
        <MigrationForm 
          onStart={handleStartMigration} 
          isStarting={isStarting} 
          startError={startError} 
        />
      )}
    </div>
  );
};
