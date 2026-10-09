import {
  Cpu,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
  Layers,
  ShieldCheck,
  Code2,
} from 'lucide-react';
import type { DetectedTech } from '@/entities/migration';

interface TechDetectionBannerProps {
  targetPath: string;
  detecting: boolean;
  detectError: string | null;
  hasHighConfidence: boolean;
  detectedTech: DetectedTech[] | null;
}

export const TechDetectionBanner = ({
  targetPath,
  detecting,
  detectError,
  hasHighConfidence,
  detectedTech,
}: TechDetectionBannerProps) => {
  if (!targetPath) return null;

  return (
    <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">
      {detecting ? (
        <div className="p-4 border-2 border-neo-border bg-neo-primary/10 flex items-center justify-center gap-3 font-mono font-bold text-neo-primary animate-pulse shadow-[4px_4px_0px_0px_var(--neo-shadow)]">
          <Loader2 size={18} className="animate-spin" /> SCANNING DIRECTORY FOR ARCHITECTURE & FRAMEWORKS...
        </div>
      ) : detectError ? (
        <div className="p-4 border-2 border-red-500 bg-red-100 flex items-center justify-center gap-3 font-mono font-bold text-red-700 shadow-[4px_4px_0px_0px_#ef4444]">
          <AlertTriangle size={18} /> {detectError}
        </div>
      ) : hasHighConfidence && detectedTech && detectedTech[0] ? (
        <div className="p-4 border-2 border-green-500 bg-green-50 flex flex-col gap-3 font-mono font-bold text-green-900 shadow-[4px_4px_0px_0px_#22c55e]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-green-200 pb-2">
            <div className="flex items-center gap-2 text-base font-black">
              <CheckCircle2 size={20} className="text-green-600" />
              <span>DETECTED: {detectedTech[0].framework.toUpperCase()}</span>
              <span className="text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded font-normal">
                {detectedTech[0].confidence}% Confidence
              </span>
            </div>

            {detectedTech[0].profile && (
              <div className="flex flex-wrap items-center gap-1.5">
                {detectedTech[0].profile.variant && detectedTech[0].profile.variant !== 'none' && (
                  <span className="px-2 py-0.5 text-xs bg-white border border-green-400 rounded flex items-center gap-1 text-green-950 font-bold">
                    <Layers size={13} className="text-green-700" /> {detectedTech[0].profile.variant}
                  </span>
                )}
                {detectedTech[0].profile.bundler && detectedTech[0].profile.bundler !== 'unknown' && (
                  <span className="px-2 py-0.5 text-xs bg-white border border-green-400 rounded flex items-center gap-1 text-green-950 font-bold">
                    <Cpu size={13} className="text-purple-700" /> {detectedTech[0].profile.bundler}
                  </span>
                )}
                {detectedTech[0].profile.language && (
                  <span className="px-2 py-0.5 text-xs bg-white border border-green-400 rounded flex items-center gap-1 text-green-950 font-bold">
                    <Code2 size={13} className="text-blue-700" /> {detectedTech[0].profile.language.toUpperCase()}
                  </span>
                )}
              </div>
            )}
          </div>

          {detectedTech[0].profile?.subsumedDependencies && detectedTech[0].profile.subsumedDependencies.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-900 bg-amber-50 p-2 border border-amber-300 rounded font-mono">
              <ShieldCheck size={14} className="text-amber-600 shrink-0" />
              <span>Absorbed underlying runtime: <strong>{detectedTech[0].profile.subsumedDependencies.join(', ')}</strong></span>
            </div>
          )}

          <div className="text-xs text-green-800/80 font-normal">
            Evidence: {detectedTech[0].evidence.join('; ')}
          </div>
        </div>
      ) : detectedTech && detectedTech.length > 0 ? (
        <div className="p-4 border-2 border-yellow-500 bg-yellow-100 flex items-center justify-center gap-3 font-mono font-bold text-yellow-800 shadow-[4px_4px_0px_0px_#eab308]">
          <Info size={18} /> LOW CONFIDENCE DETECTION: {detectedTech[0].framework.toUpperCase()}
        </div>
      ) : (
        <div className="p-4 border-2 border-neo-border bg-neo-text/5 flex items-center justify-center gap-3 font-mono font-bold text-neo-text/50">
          NO SUPPORTED FRAMEWORKS DETECTED
        </div>
      )}
    </div>
  );
};
