import { AlertTriangle, Trash2, Terminal } from 'lucide-react';
import type { MigrationPlan } from '@/entities/migration';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  return `${mins}m ${remSecs}s`;
}

interface DashboardStatusBannerProps {
  latestPlan: MigrationPlan;
  isFinished: boolean;
  isApplied: boolean;
  isFailed: boolean;
  isIntegrating: boolean;
  latestStatusMessage: string | null;
  lastApplyBranch?: string;
  isStalled?: boolean;
  stalledDurationSeconds?: number;
  onDiscard?: () => void;
}

export const DashboardStatusBanner = ({
  latestPlan,
  isFinished,
  isApplied,
  isFailed,
  isIntegrating,
  latestStatusMessage,
  lastApplyBranch,
  isStalled,
  stalledDurationSeconds = 0,
  onDiscard,
}: DashboardStatusBannerProps) => {
  if (!isFinished) {
    if (isStalled) {
      return (
        <div className="mb-6 p-4 border-4 border-neo-border bg-amber-300 text-black shadow-[4px_4px_0px_0px_var(--neo-text)]">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-950 flex-shrink-0" />
                <p className="font-black uppercase tracking-widest text-sm text-amber-950">
                  Migration Run Inactive or Interrupted ({formatDuration(stalledDurationSeconds)})
                </p>
              </div>
              <p className="font-bold text-sm leading-relaxed text-amber-950">
                No swarm events have been registered in the last {formatDuration(stalledDurationSeconds)}. If your terminal process was stopped, ran out of LLM tokens, or crashed, the swarm cannot make progress.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 bg-amber-200/80 p-2 border-2 border-amber-950/20">
                <Terminal size={14} className="flex-shrink-0" />
                <span>
                  To restart from terminal:{' '}
                  <code className="font-mono font-bold bg-amber-100 px-1 border border-amber-400">
                    metamorph run &quot;{latestPlan.targetPath || '.'}&quot; --from {latestPlan.sourceFramework} --to {latestPlan.targetFramework}
                  </code>
                </span>
              </div>
            </div>
            {onDiscard && (
              <div className="flex-shrink-0 self-start md:self-center">
                <button
                  onClick={onDiscard}
                  className="neo-btn font-black text-xs uppercase px-3 py-2 bg-red-300 hover:bg-red-400 text-red-950 border-2 border-neo-border flex items-center gap-1.5 shadow-[2px_2px_0px_0px_var(--neo-text)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
                  title="Discard this stalled migration and reset workspace"
                >
                  <Trash2 size={14} /> Discard & Reset
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
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
    );
  }

  if (isFinished && !isApplied) {
    return (
      <div className={`mb-6 p-4 border-4 border-neo-border text-black ${isFailed ? 'bg-red-400' : 'bg-green-400'}`}>
        <p className="font-black uppercase tracking-widest text-sm mb-1">
          {isFailed ? 'Build did not pass' : 'Ready to apply'}
        </p>
        <p className="font-bold text-sm leading-relaxed">
          {isFailed
            ? 'Shadow npm install / npm run build (or timeout) failed after repair rounds. Applying this migration is blocked to protect your repository from broken code. Discard this run or start a new migration.'
            : 'Apply copies the shadow result into your repo on a git branch (including MIGRATION.md). Discard deletes the shadow run. Apply is one-shot.'}
        </p>
      </div>
    );
  }

  if (isApplied) {
    const branchName = latestPlan.appliedBranch || lastApplyBranch;
    return (
      <div className="mb-6 p-4 border-4 border-neo-border bg-green-400 text-black">
        <p className="font-black uppercase tracking-widest text-sm mb-1">Applied</p>
        <p className="font-bold text-sm leading-relaxed">
          This run is already in your project{branchName ? ` on branch ${branchName}` : ''}. Applying again would redo the same git checkout. Start a new migration, or open Next steps for install commands.
        </p>
      </div>
    );
  }

  return null;
};
