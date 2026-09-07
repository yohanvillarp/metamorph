import { AlertTriangle, Activity, CheckCircle2, Clock, ListTree, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'failed';

interface Task {
  filePath: string;
  status: string;
  error?: string;
}

interface MigrationQueueProps {
  tasks: Task[];
}

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in_progress', label: 'Working' },
  { id: 'pending', label: 'Queued' },
  { id: 'completed', label: 'Done' },
  { id: 'failed', label: 'Failed' },
];

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  pending: 1,
  failed: 2,
  completed: 3,
};

function displayName(filePath: string) {
  if (filePath.startsWith('system:')) {
    return filePath.replace('system:', '').replace(/_/g, ' ');
  }
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts.slice(-2).join('/');
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return <span className="inline-flex items-center gap-1 text-green-800 bg-green-300 border-2 border-neo-border px-2 py-1 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 size={14} /> Done</span>;
  }
  if (status === 'in_progress') {
    return <span className="inline-flex items-center gap-1 text-blue-900 bg-blue-300 border-2 border-neo-border px-2 py-1 text-[10px] font-black uppercase tracking-widest animate-pulse"><Activity size={14} /> Working</span>;
  }
  if (status === 'failed') {
    return <span className="inline-flex items-center gap-1 text-red-900 bg-red-300 border-2 border-neo-border px-2 py-1 text-[10px] font-black uppercase tracking-widest"><AlertTriangle size={14} /> Failed</span>;
  }
  return <span className="inline-flex items-center gap-1 text-yellow-900 bg-yellow-300 border-2 border-neo-border px-2 py-1 text-[10px] font-black uppercase tracking-widest"><Clock size={14} /> Queued</span>;
}

export const MigrationQueue = ({ tasks }: MigrationQueueProps) => {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => ({
    all: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  }), [tasks]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...tasks]
      .filter((t) => filter === 'all' || t.status === filter)
      .filter((t) => !q || t.filePath.toLowerCase().includes(q))
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.filePath.localeCompare(b.filePath));
  }, [tasks, filter, query]);

  const done = counts.completed;
  const total = Math.max(tasks.length, 1);
  const pct = Math.round((done / total) * 100);

  return (
    <section className="neo-card p-0 overflow-hidden flex flex-col animate-in fade-in duration-300">
      <div className="p-4 sm:p-5 border-b-2 border-neo-border bg-neo-primary text-neo-primary-text">
        <h2 className="font-black text-lg sm:text-xl uppercase tracking-widest flex items-center gap-2">
          <ListTree /> File queue
        </h2>
        <p className="text-xs font-bold mt-1 opacity-90">What the Worker still has to migrate. Integration and Reporter are not files — see Live Swarm.</p>
      </div>

      <div className="p-4 border-b-2 border-neo-border space-y-3">
        <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest">
          <span>{done} / {tasks.length} files done</span>
          <span>{pct}%</span>
        </div>
        <div className="h-3 border-2 border-neo-border bg-white">
          <div className="h-full bg-green-400" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1 border-2 border-neo-border text-[10px] font-black uppercase tracking-widest ${filter === item.id ? 'bg-black text-white' : 'bg-white hover:bg-yellow-200'}`}
            >
              {item.label} {counts[item.id]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 border-2 border-neo-border bg-white px-3 py-2">
          <Search size={16} className="shrink-0 text-neo-text/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by path…"
            className="w-full bg-transparent text-sm font-mono outline-none"
          />
        </label>
      </div>

      <ul className="overflow-auto max-h-[min(62vh,34rem)] divide-y-2 divide-neo-border">
        {rows.length === 0 && (
          <li className="p-8 text-center font-bold text-neo-text/50">
            {tasks.length === 0 ? 'Waiting for Mapper to discover files…' : 'No files match this filter.'}
          </li>
        )}
        {rows.map((task) => (
          <li key={task.filePath} className="p-3 sm:p-4 hover:bg-neo-text/5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="font-black text-sm break-all">{displayName(task.filePath)}</p>
                <p className="font-mono text-[11px] text-neo-text/55 break-all mt-0.5">{task.filePath}</p>
              </div>
              <StatusBadge status={task.status} />
            </div>
            {task.error && (
              <p className="mt-2 text-xs font-bold text-red-800 bg-red-100 border-2 border-red-400 p-2 break-words">
                {task.error}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
