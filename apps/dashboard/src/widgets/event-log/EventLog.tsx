import { eventAgent, eventHeadline, eventLevel, humanEventTitle } from '@/entities/migration/eventCopy';
import type { SwarmAgentId } from '@/entities/migration/agents';
import { ChevronDown, ChevronRight, Radio, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

interface LogEvent {
  id: number;
  eventName: string;
  payload?: Record<string, unknown>;
  timestamp: string | Date;
}

interface EventLogProps {
  events: LogEvent[];
}

const AGENT_FILTERS: Array<'all' | SwarmAgentId | 'System'> = [
  'all',
  'Mapper',
  'Worker',
  'Reviewer',
  'Integration',
  'Reporter',
  'System',
];

const AGENT_COLORS: Record<string, string> = {
  Mapper: 'bg-yellow-300',
  Worker: 'bg-blue-300',
  Reviewer: 'bg-purple-300',
  Integration: 'bg-cyan-300',
  Reporter: 'bg-green-300',
  System: 'bg-white',
};

function formatTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const EventLog = ({ events }: EventLogProps) => {
  const [agent, setAgent] = useState<(typeof AGENT_FILTERS)[number]>('all');
  const [query, setQuery] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((evt) => {
      const who = eventAgent(evt.eventName, evt.payload);
      if (agent !== 'all' && who !== agent) return false;
      if (errorsOnly && eventLevel(evt.eventName, evt.payload) === 'info') return false;
      if (!q) return true;
      const hay = `${evt.eventName} ${eventHeadline(evt.eventName, evt.payload)} ${JSON.stringify(evt.payload ?? {})}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, agent, query, errorsOnly]);

  return (
    <section className="neo-card p-0 overflow-hidden flex flex-col animate-in fade-in duration-300">
      <div className="p-4 sm:p-5 border-b-2 border-neo-border">
        <h2 className="neo-title flex items-center gap-2 mb-1">
          <Radio /> Activity log
        </h2>
        <p className="text-xs font-bold text-neo-text/60">Newest first. Status lines are what the swarm is doing; open Details only if you need the raw payload.</p>
      </div>

      <div className="p-4 border-b-2 border-neo-border space-y-3">
        <div className="flex flex-wrap gap-2">
          {AGENT_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAgent(id)}
              className={`px-3 py-1 border-2 border-neo-border text-[10px] font-black uppercase tracking-widest ${agent === id ? 'bg-black text-white' : 'bg-white hover:bg-yellow-200'}`}
            >
              {id === 'all' ? 'All' : id}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setErrorsOnly((value) => !value)}
            className={`px-3 py-1 border-2 border-neo-border text-[10px] font-black uppercase tracking-widest ${errorsOnly ? 'bg-red-400 text-black' : 'bg-white hover:bg-red-100'}`}
          >
            Problems
          </button>
        </div>
        <label className="flex items-center gap-2 border-2 border-neo-border bg-white px-3 py-2">
          <Search size={16} className="shrink-0 text-neo-text/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages, files, agents…"
            className="w-full bg-transparent text-sm font-mono outline-none"
          />
        </label>
      </div>

      <ol className="flex-1 overflow-y-auto max-h-[min(62vh,34rem)] divide-y-2 divide-neo-border">
        {rows.length === 0 && (
          <li className="p-8 text-center font-bold text-neo-text/50">
            {events.length === 0 ? 'Waiting for the swarm to emit events…' : 'No events match this filter.'}
          </li>
        )}
        {rows.map((evt) => {
          const who = eventAgent(evt.eventName, evt.payload);
          const level = eventLevel(evt.eventName, evt.payload);
          const open = openId === evt.id;
          return (
            <li
              key={evt.id}
              className={`p-3 sm:p-4 ${level === 'error' ? 'bg-red-50' : level === 'warning' ? 'bg-yellow-50' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border-2 border-neo-border ${AGENT_COLORS[who]}`}>
                  {who}
                </span>
                <span className="text-[11px] font-mono text-neo-text/55">{formatTime(evt.timestamp)}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-neo-text/40">
                  {humanEventTitle(evt.eventName)}
                </span>
              </div>
              <p className="font-bold text-sm leading-relaxed break-words">{eventHeadline(evt.eventName, evt.payload)}</p>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : evt.id)}
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-neo-text/60 hover:text-neo-text"
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Details
              </button>
              {open && (
                <pre className="mt-2 text-[11px] font-mono text-neo-text/80 bg-white p-2 border-2 border-neo-border overflow-x-auto">
                  {JSON.stringify({ event: evt.eventName, ...(evt.payload ?? {}) }, null, 2)}
                </pre>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
