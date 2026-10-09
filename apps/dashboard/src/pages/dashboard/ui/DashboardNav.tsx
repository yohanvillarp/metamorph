import { Cpu, HardDrive, LayoutDashboard, Radio } from 'lucide-react';
import type { Tab } from '@/entities/migration';

interface DashboardNavProps {
  activeTab: Tab;
  onSelectTab: (tab: Tab) => void;
}

export const DashboardNav = ({ activeTab, onSelectTab }: DashboardNavProps) => {
  return (
    <nav className="flex flex-wrap gap-4 border-b-2 border-neo-border pb-4">
      <button
        onClick={() => onSelectTab('overview')}
        className={`neo-btn flex items-center gap-2 ${activeTab === 'overview' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
      >
        <LayoutDashboard size={18} /> Overview
      </button>
      <button
        onClick={() => onSelectTab('swarm')}
        className={`neo-btn flex items-center gap-2 ${activeTab === 'swarm' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
      >
        <Cpu size={18} /> Live Swarm
      </button>
      <button
        onClick={() => onSelectTab('queue')}
        className={`neo-btn flex items-center gap-2 ${activeTab === 'queue' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
      >
        <HardDrive size={18} /> Queue
      </button>
      <button
        onClick={() => onSelectTab('events')}
        className={`neo-btn flex items-center gap-2 ${activeTab === 'events' ? 'bg-neo-primary text-neo-primary-text translate-x-[2px] translate-y-[2px] shadow-none' : ''}`}
      >
        <Radio size={18} /> Event Log
      </button>
    </nav>
  );
};
