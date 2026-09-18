import { SWARM_AGENTS, classifySwarmAgent, type SwarmAgentId } from '@/entities/migration/agents';
import { useMemo } from 'react';

type FileStage = 'queued' | 'working' | 'reviewing' | 'done' | 'failed';

const FILE_STEPS: { id: FileStage; label: string }[] = [
  { id: 'queued', label: 'Queued' },
  { id: 'working', label: 'Worker' },
  { id: 'reviewing', label: 'Review' },
  { id: 'done', label: 'Done' },
];

function stageFromTask(status: string, eventStage?: FileStage): FileStage {
  if (status === 'failed') return 'failed';
  if (status === 'completed') return 'done';
  if (status === 'in_progress') return eventStage === 'reviewing' ? 'reviewing' : 'working';
  if (eventStage) return eventStage;
  return 'queued';
}

function eventStageForFile(events: any[], filePath: string): FileStage | undefined {
  const related = events.filter((evt) => String(evt.payload?.filePath ?? '') === filePath);
  let stage: FileStage | undefined;
  for (const evt of [...related].reverse()) {
    const name = String(evt.eventName ?? '').toLowerCase();
    if (name.includes('fatal')) return 'failed';
    if (name.includes('reject')) stage = 'working';
    else if (name.includes('review')) stage = 'done';
    else if (name.includes('migrat') && !name.includes('started') && !name.includes('completed')) stage = 'reviewing';
    else if (name.includes('discover')) stage = 'queued';
  }
  return stage;
}

function shortName(filePath: string) {
  return filePath.replace(/\\/g, '/').split('/').slice(-2).join('/');
}

interface LiveSwarmProps {
  events: any[];
  tasks: Array<{ filePath: string; status: string; error?: string }>;
  activeAgent: SwarmAgentId | null;
  isIntegrating: boolean;
  isFinished: boolean;
  latestStatus: string | null;
}

export const LiveSwarm = ({
  events,
  tasks,
  activeAgent,
  isIntegrating,
  isFinished,
  latestStatus,
}: LiveSwarmProps) => {
  const lastByAgent = useMemo(() => {
    const map = {} as Record<SwarmAgentId, string>;
    for (const evt of events) {
      const agent = classifySwarmAgent(evt.eventName, evt.payload);
      if (!agent || map[agent]) continue;
      const message = typeof evt.payload?.message === 'string' ? evt.payload.message : '';
      const file = typeof evt.payload?.filePath === 'string' ? shortName(evt.payload.filePath) : '';
      map[agent] = message || file || String(evt.eventName ?? '');
    }
    return map;
  }, [events]);

  const files = useMemo(() => {
    return (tasks || [])
      .filter((task) => !String(task.filePath).startsWith('system:'))
      .map((task) => ({
        path: task.filePath,
        error: task.error,
        stage: stageFromTask(task.status, eventStageForFile(events, task.filePath)),
      }));
  }, [tasks, events]);

  const working = files.filter((f) => f.stage === 'working' || f.stage === 'reviewing').length;
  const done = files.filter((f) => f.stage === 'done').length;
  const failed = files.filter((f) => f.stage === 'failed').length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {SWARM_AGENTS.map((agent) => {
          const busy = activeAgent === agent.id || (agent.id === 'Integration' && isIntegrating && !isFinished);
          return (
            <article
              key={agent.id}
              className="neo-card p-3 min-h-[7.5rem] flex flex-col"
              style={busy ? { boxShadow: `5px 5px 0 0 ${agent.color}` } : undefined}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-black uppercase tracking-widest text-xs">{agent.id}</h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-neo-border ${busy ? 'bg-black text-white' : isFinished ? 'bg-green-200' : 'bg-white'}`}>
                  {busy ? 'Live' : isFinished ? 'Done' : lastByAgent[agent.id] ? 'Active' : 'Idle'}
                </span>
              </div>
              <p className="text-[11px] font-bold text-neo-text/60 leading-snug">{agent.hint}</p>
              <p className="mt-auto pt-2 text-[11px] font-bold leading-snug line-clamp-3" title={lastByAgent[agent.id]}>
                {busy && latestStatus && (agent.id === activeAgent || agent.id === 'Integration')
                  ? latestStatus
                  : lastByAgent[agent.id] || 'Waiting for events'}
              </p>
            </article>
          );
        })}
      </section>

      <section className="neo-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="neo-title mb-1">File pipeline</h3>
            <p className="text-xs font-bold text-neo-text/60">
              Same queue as the Queue tab. Mapper finds files, Worker rewrites, Reviewer signs off. Integration and Reporter are above — they are not files.
            </p>
          </div>
          <p className="text-xs font-black uppercase tracking-widest">
            {working} live · {done} done · {failed} failed · {files.length} files
          </p>
        </div>

        {files.length === 0 ? (
          <p className="font-bold text-neo-text/50 py-10 text-center">Waiting for Mapper to discover files…</p>
        ) : (
          <ul className="space-y-2 max-h-[min(60vh,32rem)] overflow-y-auto pr-1">
            {files.map((file) => (
              <li key={file.path} className="border-2 border-neo-border p-3 bg-white">
                <p className="font-mono text-xs sm:text-sm font-bold break-all mb-2">{file.path}</p>
                <ol className="grid grid-cols-4 gap-1">
                  {FILE_STEPS.map((step, index) => {
                    const order: FileStage[] = ['queued', 'working', 'reviewing', 'done'];
                    const current = file.stage === 'failed' ? -1 : order.indexOf(file.stage);
                    const reached = current >= index;
                    const isNow = file.stage !== 'failed' && current === index;
                    return (
                      <li
                        key={step.id}
                        className={`text-[10px] sm:text-xs font-black uppercase tracking-wide px-1 py-2 text-center border-2 border-neo-border ${
                          file.stage === 'failed' && index === 3
                            ? 'bg-red-400 text-black'
                            : isNow
                              ? 'bg-blue-300 animate-pulse'
                              : reached
                                ? 'bg-green-300'
                                : 'bg-neo-surface text-neo-text/40'
                        }`}
                      >
                        {file.stage === 'failed' && index === 3 ? 'Failed' : step.label}
                      </li>
                    );
                  })}
                </ol>
                {file.error && (
                  <p className="mt-2 text-xs font-bold text-red-700 break-words">{file.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
