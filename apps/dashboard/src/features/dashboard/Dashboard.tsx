import { useState, useEffect, useMemo } from 'react';
import { Activity, HardDrive, CheckCircle2, Clock, Terminal, AlertTriangle, LayoutDashboard, Cpu, ListTree, Radio } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SwarmSwimlanes } from './SwarmSwimlanes';

type Tab = 'overview' | 'swarm' | 'queue' | 'events';

export const Dashboard = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const fetchData = async () => {
    try {
      const [plansRes, eventsRes] = await Promise.all([
        fetch('http://localhost:3000/api/plans'),
        fetch('http://localhost:3000/api/events')
      ]);
      const plansData = await plansRes.json();
      const eventsData = await eventsRes.json();
      setPlans(plansData);
      setEvents(eventsData);
    } catch (error) {
      console.error("API Connection Error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const latestPlan = plans[0];
  const pendingTasks = latestPlan?.tasks.filter((t: any) => t.status === 'pending').length || 0;
  const inProgressTasks = latestPlan?.tasks.filter((t: any) => t.status === 'in_progress').length || 0;
  const completedTasks = latestPlan?.tasks.filter((t: any) => t.status === 'completed').length || 0;
  const failedTasks = latestPlan?.tasks.filter((t: any) => t.status === 'failed').length || 0;

  // Derive Agent Stats for the Chart
  const currentRunEvents = useMemo(() => {
    if (events.length === 0) return [];
    const latestPlanId = events[0].payload?.planId;
    if (!latestPlanId) return events;
    return events.filter(e => e.payload?.planId === latestPlanId);
  }, [events]);

  const chartData = useMemo(() => {
    const data = [
      { name: 'System', events: 0, color: '#4ade80' },
      { name: 'Mapper', events: 0, color: '#facc15' },
      { name: 'Worker', events: 0, color: '#93c5fd' },
      { name: 'Reviewer', events: 0, color: '#c084fc' },
    ];
    
    currentRunEvents.forEach(evt => {
      const name = evt.eventName.toLowerCase();
      if (name.includes('discover')) data[1].events++;
      else if (name.includes('migrat') && !name.includes('started')) data[2].events++;
      else if (name.includes('review') || name.includes('approve') || name.includes('reject')) data[3].events++;
      else data[0].events++;
    });
    
    return data;
  }, [currentRunEvents]);

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col gap-8">
      
      {/* HEADER */}
      <header className="flex justify-between items-center border-b-4 border-neo-border pb-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Terminal size={36} /> Metamorph
          </h1>
          <p className="text-neo-text/70 mt-2 font-bold uppercase tracking-widest text-sm">
            AI-Powered Migration Swarm
          </p>
        </div>
        <div className="neo-badge bg-green-400 text-black flex items-center gap-2 text-lg">
          <Activity size={18} /> {loading ? 'CONNECTING...' : 'LIVE'}
        </div>
      </header>

      {latestPlan ? (
        <>
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
          <main className="flex-1">
            
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95 duration-200">
                {/* STATS */}
                <section className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="neo-card bg-yellow-300 text-black">
                    <h3 className="neo-title border-black">Pending</h3>
                    <p className="text-5xl font-black">{pendingTasks}</p>
                  </div>
                  <div className="neo-card bg-blue-300 text-black">
                    <h3 className="neo-title border-black">In Progress</h3>
                    <p className="text-5xl font-black animate-pulse">{inProgressTasks}</p>
                  </div>
                  <div className="neo-card bg-green-400 text-black">
                    <h3 className="neo-title border-black">Completed</h3>
                    <p className="text-5xl font-black">{completedTasks}</p>
                  </div>
                  <div className="neo-card bg-red-400 text-black">
                    <h3 className="neo-title border-black">Failed</h3>
                    <p className="text-5xl font-black">{failedTasks}</p>
                  </div>
                </section>

                {/* CHART */}
                <section className="neo-card lg:col-span-3 h-96 flex flex-col">
                  <h3 className="neo-title mb-6">Agent Activity Volume</h3>
                  <div className="flex-1 min-h-0 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <XAxis dataKey="name" stroke="var(--neo-text)" tick={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold' }} />
                        <YAxis stroke="var(--neo-text)" tick={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--neo-surface)', border: '2px solid var(--neo-border)', boxShadow: '4px 4px 0px 0px var(--neo-shadow)', borderRadius: '0', fontFamily: 'JetBrains Mono' }}
                          cursor={{ fill: 'var(--neo-text)', opacity: 0.1 }}
                        />
                        <Bar dataKey="events" stroke="var(--neo-border)" strokeWidth={2}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'swarm' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <SwarmSwimlanes events={currentRunEvents} />
              </div>
            )}

            {activeTab === 'queue' && (
              <section className="neo-card p-0 overflow-hidden flex flex-col animate-in fade-in duration-300">
                <div className="p-6 border-b-2 border-neo-border bg-neo-primary text-neo-primary-text">
                  <h2 className="font-black text-xl uppercase tracking-widest flex items-center gap-2">
                    <ListTree /> File Migration Queue
                  </h2>
                </div>
                <div className="overflow-auto max-h-[600px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 shadow-[0_2px_0_0_var(--neo-border)]">
                      <tr>
                        <th className="neo-table-th">File Path</th>
                        <th className="neo-table-th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestPlan.tasks.map((task: any, i: number) => (
                        <tr key={i} className="hover:bg-neo-text/5 transition-colors border-b-2 border-neo-border last:border-0">
                          <td className="neo-table-td border-l-0 text-xs font-mono">{task.filePath}</td>
                          <td className="neo-table-td">
                            {task.status === 'completed' && <span className="text-green-600 font-black flex items-center gap-1"><CheckCircle2 size={16}/> COMPLETED</span>}
                            {task.status === 'in_progress' && <span className="text-blue-600 font-black flex items-center gap-1 animate-pulse"><Activity size={16}/> MIGRATING</span>}
                            {task.status === 'pending' && <span className="text-yellow-600 font-black flex items-center gap-1"><Clock size={16}/> QUEUED</span>}
                            {task.status === 'failed' && <span className="text-red-600 font-black flex items-center gap-1"><AlertTriangle size={16}/> FAILED</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === 'events' && (
              <section className="neo-card flex flex-col animate-in fade-in duration-300">
                <h2 className="neo-title flex items-center gap-2">
                  <Radio /> System Event Log
                </h2>
                <div className="flex-1 overflow-y-auto max-h-[600px] pr-2 space-y-4">
                  {events.map((evt: any) => (
                    <div key={evt.id} className="border-l-4 border-neo-border pl-4 py-2 hover:bg-neo-text/5">
                      <p className="text-xs text-neo-text/60 font-bold mb-1 font-mono">
                        {new Date(evt.timestamp).toLocaleString()}
                      </p>
                      <p className="font-black text-sm text-neo-primary uppercase tracking-wider break-all">
                        {evt.eventName}
                      </p>
                      <pre className="mt-2 text-xs font-mono text-neo-text/80 bg-neo-text/5 p-2 border border-neo-border/20 overflow-x-auto">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <p className="text-sm font-bold text-neo-text/50">Waiting for events...</p>
                  )}
                </div>
              </section>
            )}

          </main>
        </>
      ) : (
        <div className="neo-card text-center py-32 border-dashed">
          <Terminal size={64} className="mx-auto mb-6 opacity-30" />
          <h2 className="text-3xl font-black uppercase tracking-widest mb-4">No Active Migrations</h2>
          <p className="font-bold text-lg text-neo-text/70">
            Run <code className="bg-neo-primary text-neo-primary-text px-3 py-1 mx-1 font-mono text-sm border-2 border-neo-border shadow-[2px_2px_0px_0px_var(--neo-shadow)]">metamorph run ./path --from X --to Y</code> in your terminal
          </p>
        </div>
      )}
    </div>
  );
};
