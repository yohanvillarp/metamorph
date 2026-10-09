import { Cpu, ArrowRight } from 'lucide-react';
import { FRAMEWORKS } from '@/entities/migration';

interface TechStackSelectorProps {
  targetPath: string;
  detecting: boolean;
  detectError: string | null;
  fromFw: string;
  toFw: string;
  setFromFw: (fw: string) => void;
  setToFw: (fw: string) => void;
  hasHighConfidence: boolean;
}

export const TechStackSelector = ({
  targetPath,
  detecting,
  detectError,
  fromFw,
  toFw,
  setFromFw,
  setToFw,
  hasHighConfidence,
}: TechStackSelectorProps) => {
  const selectedFromGroup = FRAMEWORKS.find((f) => f.value === fromFw)?.group;
  const compatibleToFrameworks = FRAMEWORKS.filter(
    (f) => f.group === selectedFromGroup && f.value !== fromFw
  );

  return (
    <div
      className={`w-full relative z-10 transition-all duration-500 ${
        targetPath && !detectError && !detecting
          ? 'opacity-100 translate-y-0'
          : 'opacity-30 pointer-events-none translate-y-4'
      }`}
    >
      <h3 className="font-black text-lg uppercase tracking-widest mb-4 flex items-center justify-center gap-2 border-b-2 border-neo-border pb-1">
        <Cpu size={20} className="text-blue-500" /> 2. Technology Stack
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Select FROM */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-xs uppercase tracking-widest text-neo-text/60 text-center">
            Origin Framework
          </label>
          <div className="relative">
            <select
              value={fromFw}
              onChange={(e) => setFromFw(e.target.value)}
              disabled={hasHighConfidence || detecting}
              className={`w-full p-4 pl-12 border-4 border-neo-border font-mono text-base shadow-[4px_4px_0px_0px_var(--neo-shadow)] focus:outline-none focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all appearance-none text-center ${
                hasHighConfidence
                  ? 'bg-neo-text/10 cursor-not-allowed font-black'
                  : 'bg-white cursor-pointer'
              }`}
            >
              <option value="" disabled>
                Select source...
              </option>
              {FRAMEWORKS.map((fw) => (
                <option key={fw.value} value={fw.value}>
                  {fw.label}
                </option>
              ))}
            </select>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none w-6 h-6">
              <img
                src={FRAMEWORKS.find((f) => f.value === fromFw)?.icon}
                alt=""
                className="w-full h-full object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          </div>
        </div>

        {/* ANIMATION CENTER */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center justify-center gap-4 py-4 bg-neo-text/5 border-2 border-neo-border border-dashed rounded-lg w-full shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-neo-primary to-transparent animate-pulse"></div>
            </div>

            <div className="z-10 w-20 h-20 bg-white border-4 border-neo-border shadow-[4px_4px_0px_0px_var(--neo-shadow)] flex items-center justify-center rounded p-3 transition-transform hover:scale-110 bg-grid-pattern">
              <img
                src={FRAMEWORKS.find((f) => f.value === fromFw)?.icon}
                alt={fromFw}
                className="w-full h-full object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>

            <div className="z-10 flex flex-col items-center px-2">
              <div className="flex items-center gap-1 text-neo-primary animate-pulse">
                <div className="h-1 w-2 bg-neo-primary"></div>
                <div className="h-1 w-2 bg-neo-primary"></div>
                <div className="h-1 w-2 bg-neo-primary"></div>
                <ArrowRight size={28} className="ml-1" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-neo-text/40 mt-1">
                Transform
              </span>
            </div>

            <div className="z-10 w-20 h-20 bg-white border-4 border-neo-border shadow-[4px_4px_0px_0px_var(--neo-shadow)] flex items-center justify-center rounded p-3 transition-transform hover:scale-110 bg-grid-pattern">
              <img
                key={toFw}
                src={FRAMEWORKS.find((f) => f.value === toFw)?.icon}
                alt={toFw}
                className="w-full h-full object-contain animate-in zoom-in duration-300"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          </div>
        </div>

        {/* Select TO */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-xs uppercase tracking-widest text-neo-text/60 text-center">
            Target Framework
          </label>
          <div className="relative">
            <select
              value={toFw}
              onChange={(e) => setToFw(e.target.value)}
              disabled={!fromFw || detecting}
              className="w-full p-4 pl-12 border-4 border-neo-border font-mono text-base bg-white shadow-[4px_4px_0px_0px_var(--neo-shadow)] focus:outline-none focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
            >
              <option value="" disabled>
                Select target...
              </option>
              {compatibleToFrameworks.map((fw) => (
                <option key={fw.value} value={fw.value}>
                  {fw.label}
                </option>
              ))}
            </select>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none w-6 h-6">
              <img
                src={FRAMEWORKS.find((f) => f.value === toFw)?.icon}
                alt=""
                className="w-full h-full object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
