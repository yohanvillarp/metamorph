import type { ReactNode } from 'react';

interface CostMetricCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
}

export const CostMetricCard = ({ icon, label, value, subtitle }: CostMetricCardProps) => {
  return (
    <div className="p-4 bg-neutral-800 border-2 border-black shadow-[3px_3px_0px_0px_#000]">
      <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1 font-mono">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-3xl font-black font-mono">
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-neutral-400 font-mono mt-1">
          {subtitle}
        </div>
      )}
    </div>
  );
};
