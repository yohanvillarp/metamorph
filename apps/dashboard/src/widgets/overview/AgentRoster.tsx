import { SWARM_AGENTS, type SwarmAgentId } from '@/entities/migration/agents';

interface AgentRosterProps {
  counts: Record<SwarmAgentId, number>;
  activeAgent?: SwarmAgentId | null;
}

export const AgentRoster = ({ counts, activeAgent }: AgentRosterProps) => {
  return (
    <section className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
      {SWARM_AGENTS.map((agent) => {
        const busy = activeAgent === agent.id;
        return (
          <div
            key={agent.id}
            className={`neo-card p-4 ${busy ? 'ring-4 ring-offset-0' : ''}`}
            style={busy ? { boxShadow: `6px 6px 0 0 ${agent.color}` } : undefined}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-black uppercase tracking-widest text-sm">{agent.id}</h3>
              <span
                className={`text-[10px] font-black uppercase px-2 py-1 border-2 border-neo-border ${busy ? 'bg-black text-white' : 'bg-white'}`}
              >
                {busy ? 'Working' : counts[agent.id] > 0 ? 'Active' : 'Idle'}
              </span>
            </div>
            <p className="text-xs font-bold text-neo-text/70 leading-snug">{agent.hint}</p>
            <p className="text-2xl font-black mt-2">{counts[agent.id]}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neo-text/50">events</p>
          </div>
        );
      })}
    </section>
  );
};
