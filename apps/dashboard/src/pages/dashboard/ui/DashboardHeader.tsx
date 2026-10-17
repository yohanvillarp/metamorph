import { BookOpen, Bug, Globe, MessageSquare, Plus, Trash2 } from 'lucide-react';
import type { MigrationPlan } from '@/entities/migration';
import { PROJECT_LINKS } from '@/shared/config';

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
      <a href={PROJECT_LINKS.website} target="_blank" rel="noreferrer noopener" title="Metamorph Official Website" className="flex items-center gap-3 hover:opacity-80">
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
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        {latestPlan && !isFinished && (
          <div className="flex flex-wrap items-center gap-2 border-r-2 border-neo-border pr-2 md:pr-4">
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
          <div className="flex flex-wrap items-center gap-2 border-r-2 border-neo-border pr-2 md:pr-4">
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
          href={PROJECT_LINKS.docs}
          target="_blank"
          rel="noreferrer noopener"
          className="neo-btn font-black text-sm uppercase px-3 py-2 flex items-center gap-1.5 hover:bg-neo-primary hover:text-neo-primary-text transition-colors"
          title="Official Documentation"
        >
          <BookOpen size={16} /> Docs
        </a>
        <a
          href={PROJECT_LINKS.discord}
          target="_blank"
          rel="noreferrer noopener"
          className="neo-btn font-black text-sm uppercase px-3 py-2 flex items-center gap-1.5 hover:bg-[#5865F2] hover:text-white transition-colors"
          title="Discord Community"
        >
          <MessageSquare size={16} /> Community
        </a>
        <a
          href={PROJECT_LINKS.website}
          target="_blank"
          rel="noreferrer noopener"
          className="neo-btn font-black text-sm uppercase px-2.5 py-2 hover:bg-yellow-300 transition-colors"
          title="Official Website"
        >
          <Globe size={18} />
        </a>
        <a
          href={PROJECT_LINKS.github}
          target="_blank"
          rel="noreferrer noopener"
          className="neo-btn font-black text-sm uppercase px-2.5 py-2 hover:bg-neo-primary hover:text-neo-primary-text transition-colors"
          title="GitHub Repository"
        >
          <img src="/github.svg" alt="GitHub" className="h-5 w-5" />
        </a>
        <a
          href={PROJECT_LINKS.reportIssue}
          target="_blank"
          rel="noreferrer noopener"
          className="neo-btn font-black text-sm uppercase px-3 py-2 flex items-center gap-1.5 hover:bg-yellow-300 hover:text-black transition-colors"
          title="Report Issue on GitHub Discussions"
        >
          <Bug size={16} /> Issue
        </a>
      </div>
    </header>
  );
};
