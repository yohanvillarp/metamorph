import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

interface OverviewStatsProps {
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  failedTasks: number;
  chartData: any[];
}

export const OverviewStats = ({ pendingTasks, inProgressTasks, completedTasks, failedTasks, chartData }: OverviewStatsProps) => {
  return (
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
  );
};
