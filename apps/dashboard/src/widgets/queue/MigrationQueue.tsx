import { ListTree, CheckCircle2, Activity, Clock, AlertTriangle } from 'lucide-react';

interface MigrationQueueProps {
  tasks: any[];
}

export const MigrationQueue = ({ tasks }: MigrationQueueProps) => {
  return (
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
            {tasks.map((task: any, i: number) => (
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
  );
};
