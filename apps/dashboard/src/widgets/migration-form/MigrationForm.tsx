import { useState, useEffect } from 'react';
import {
  FolderOpen,
  AlertTriangle,
  Loader2,
  Play,
  Boxes,
} from 'lucide-react';
import { FolderPicker } from '@/shared/ui/FolderPicker';
import type { DetectedTech, MonorepoContext } from '@/entities/migration';
import { TechDetectionBanner } from './TechDetectionBanner';
import { TechStackSelector } from './TechStackSelector';

const API_BASE = '';

interface MigrationFormProps {
  onStart: (targetPath: string, fromFw: string, toFw: string) => void;
  isStarting: boolean;
  startError: string | null;
}

export const MigrationForm = ({ onStart, isStarting, startError }: MigrationFormProps) => {
  const [targetPath, setTargetPath] = useState('');
  const [fromFw, setFromFw] = useState('');
  const [toFw, setToFw] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectedTech, setDetectedTech] = useState<DetectedTech[] | null>(null);
  const [monorepo, setMonorepo] = useState<MonorepoContext | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetPath) {
      setDetectedTech(null);
      setMonorepo(null);
      setDetectError(null);
      setFromFw('');
      return;
    }

    const detect = async () => {
      setDetecting(true);
      setDetectError(null);
      try {
        const res = await fetch(`${API_BASE}/api/detect?path=${encodeURIComponent(targetPath)}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setDetectedTech(data.detected);
        setMonorepo(data.monorepo || null);
        if (data.primary) {
          setFromFw(data.primary);
        } else {
          setFromFw('');
          if (data.monorepo?.packages?.length > 0) {
            setDetectError('Monorepo detected. Please select a workspace package below to migrate.');
          } else {
            setDetectError('No supported framework detected in this directory.');
          }
        }
      } catch (err: unknown) {
        setDetectError(err instanceof Error ? err.message : String(err));
      } finally {
        setDetecting(false);
      }
    };
    detect();
  }, [targetPath]);

  const hasHighConfidence = Boolean(
    detectedTech && detectedTech.length > 0 && detectedTech[0].confidence > 50
  );
  const canLaunch = Boolean(fromFw && toFw && !detectError && !isStarting);

  return (
    <div className="neo-card border-dashed max-w-4xl mx-auto w-full p-4 md:p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neo-primary/10 via-transparent to-transparent opacity-50 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-3xl mx-auto flex flex-col items-center gap-4">
        <header className="w-full text-center">
          <a
            href="https://github.com/yohanvillarp/metamorph"
            target="_blank"
            rel="noreferrer"
            title="Metamorph on GitHub"
            className="inline-flex items-center justify-center gap-3 hover:opacity-80"
          >
            <img src="/logo_metamorph.png" alt="" className="h-10 w-10 object-contain" />
            <span className="text-lg md:text-xl font-black uppercase tracking-widest">Metamorph</span>
          </a>
          <h2 className="mt-4 text-2xl md:text-3xl font-black uppercase tracking-widest leading-none">
            Launch Migration
          </h2>
          <p className="mt-2 font-bold text-xs md:text-sm text-neo-text/60 uppercase tracking-wider">
            Configure your AI transformation swarm
          </p>
        </header>

        <div className="w-full relative z-30 space-y-3">
          <h3 className="font-black text-lg uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 border-neo-border pb-1">
            <FolderOpen size={20} className="text-yellow-500" /> 1. Select Workspace
          </h3>
          <FolderPicker value={targetPath} onChange={setTargetPath} />

          {/* MONOREPO WORKSPACE SELECTOR */}
          {monorepo?.isMonorepo && monorepo.packages.length > 0 && (
            <div className="w-full p-4 border-2 border-neo-border bg-blue-50/60 shadow-[4px_4px_0px_0px_var(--neo-shadow)] flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-blue-200 pb-1.5">
                <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider text-blue-900">
                  <Boxes size={16} className="text-blue-600" /> Monorepo detected (
                  {monorepo.tool || 'workspaces'})
                </div>
                <span className="text-[11px] font-mono text-blue-700 font-bold">
                  {monorepo.packages.length} workspace packages
                </span>
              </div>
              <div className="text-xs text-blue-950 font-medium">
                Choose a specific workspace package to target:
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {monorepo.packages.map((pkg) => (
                  <button
                    key={pkg.absolutePath}
                    type="button"
                    onClick={() => setTargetPath(pkg.absolutePath)}
                    className={`px-3 py-1.5 border-2 text-xs font-mono font-bold transition-all ${
                      targetPath === pkg.absolutePath
                        ? 'bg-blue-600 text-white border-blue-900 shadow-[2px_2px_0px_0px_#1e3a8a] translate-x-[1px] translate-y-[1px]'
                        : 'bg-white text-neo-text border-neo-border hover:bg-blue-100 shadow-[2px_2px_0px_0px_var(--neo-shadow)]'
                    }`}
                  >
                    <span className="font-black">{pkg.name}</span>
                    <span className="opacity-70 ml-1.5 text-[10px]">({pkg.relativePath})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <TechDetectionBanner
            targetPath={targetPath}
            detecting={detecting}
            detectError={detectError}
            hasHighConfidence={hasHighConfidence}
            detectedTech={detectedTech}
          />
        </div>

        <TechStackSelector
          targetPath={targetPath}
          detecting={detecting}
          detectError={detectError}
          fromFw={fromFw}
          toFw={toFw}
          setFromFw={setFromFw}
          setToFw={setToFw}
          hasHighConfidence={hasHighConfidence}
        />

        <div className="w-full flex flex-col items-center relative z-10 pt-2">
          {startError && (
            <div className="bg-red-100 border-4 border-red-500 p-4 mb-6 w-full text-red-900 font-bold text-sm text-center shadow-[4px_4px_0px_0px_#ef4444] animate-in slide-in-from-bottom-2">
              <AlertTriangle size={24} className="mx-auto mb-2" />
              {startError}
            </div>
          )}

          <button
            onClick={() => onStart(targetPath, fromFw, toFw)}
            disabled={!canLaunch}
            className={`w-full border-4 border-black text-white flex items-center justify-center gap-4 text-xl md:text-2xl py-4 font-black uppercase tracking-widest transition-all duration-300 ${
              canLaunch
                ? 'bg-neo-primary hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none shadow-[8px_8px_0px_0px_#000]'
                : 'bg-neo-text/50 opacity-50 cursor-not-allowed shadow-[8px_8px_0px_0px_#000]'
            }`}
          >
            {isStarting ? (
              <>
                <Loader2 size={32} className="animate-spin" /> DISPATCHING SWARM...
              </>
            ) : (
              <>
                <Play size={32} /> LAUNCH METAMORPH SWARM
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
