import { Bug, Plus, Trash2 } from 'lucide-react';
import type { MigrationPlan } from '@/entities/migration';

const GITHUB_REPO = 'https://github.com/yohanvillarp/metamorph';

interface DashboardHeaderProps {
  latestPlan: MigrationPlan | null;
  isFinished: boolean;
  isApplied: boolean;
  canApply: boolean;
  isApplying: boolean;
  onApply: () => void;
  onDiscard: () => void;
  onReset: () => void;
}

export const DashboardHeader = ({
  latestPlan,
  isFinished,
  isApplied,
  canApply,
  isApplying,
  onApply,
  onDiscard,
  onReset,
}: DashboardHeaderProps) => {
  return (
    <header className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-8 pb-4 border-b-4 border-neo-border">
      <a href={GITHUB_REPO} target="_blank" rel="noreferrer" title="Metamorph on GitHub" className="flex items-center gap-3 hover:opacity-80">
        <img src="/logo_metamorph.png" alt="" className="h-12 w-12 border-2 border-neo-border bg-white object-contain" />
        <div>
          <h1 className="text-3xl font-black uppercase tracking-widest flex items-center gap-2">
            Metamorph
          </h1>
          <p className="text-sm font-bold text-neo-text/60 uppercase tracking-widest mt-1">
            AI-Powered Migration Swarm
          </p>
        </div>
      </a>
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        {latestPlan && !isFinished && (
          <div className="flex flex-wrap items-center gap-2 border-r-2 border-neo-border pr-4 md:pr-6">
            <button
              onClick={onDiscard}
              className="neo-btn font-black text-sm uppercase px-4 py-2 hover:bg-red-200 text-red-950 border-2 border-neo-border flex items-center gap-2 shadow-[2px_2px_0px_0px_var(--neo-text)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
              title="Discard this incomplete run and reset workspace"
            >
              <Trash2 size={16} /> Discard Run
            </button>
          </div>
        )}

        {latestPlan && isFinished && !isApplied && (
          <div className="flex flex-wrap items-center gap-2 border-r-2 border-neo-border pr-4 md:pr-6">
            {canApply ? (
              <button
                onClick={onApply}
                disabled={isApplying}
                className="bg-green-400 font-black text-sm uppercase px-4 py-2 border-2 border-neo-border hover:bg-green-500 transition-colors shadow-[4px_4px_0px_0px_var(--neo-text)] active:translate-y-1 active:translate-x-1 active:shadow-none"
              >
                {isApplying ? 'Applying...' : 'Apply Migration'}
              </button>
            ) : (
              <span className="bg-red-200 text-red-950 font-black text-xs uppercase px-3 py-2 border-2 border-neo-border">
                Apply Blocked: Migration Failed
              </span>
            )}
            <button
              onClick={onDiscard}
              className="neo-btn font-black text-sm uppercase px-4 py-2 hover:bg-red-200 flex items-center gap-1.5"
            >
              <Trash2 size={16} /> Discard
            </button>
          </div>
        )}

        {latestPlan && isApplied && (
          <button
            onClick={onReset}
            className="neo-btn font-black text-sm uppercase px-4 py-2 hover:bg-yellow-300 flex items-center gap-2"
          >
            <Plus size={16} /> Start New Migration
          </button>
        )}

        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noreferrer"
          className="neo-btn font-black text-sm uppercase px-3 py-2 hover:bg-neo-primary hover:text-neo-primary-text transition-colors"
          title="GitHub Repository"
        >
          <img src="/github.svg" alt="GitHub" className="h-5 w-5" />
        </a>
        <a
          href={`${GITHUB_REPO}/discussions/new?category=q-a`}
          target="_blank"
          rel="noreferrer"
          className="neo-btn font-black text-sm uppercase px-4 py-2 flex items-center gap-2 hover:bg-yellow-300 hover:text-black transition-colors"
        >
          <Bug size={16} /> Report Issue
        </a>
      </div>
    </header>
  );
};
