import { Radio } from 'lucide-react';

interface EventLogProps {
  events: any[];
}

export const EventLog = ({ events }: EventLogProps) => {
  return (
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
  );
};
