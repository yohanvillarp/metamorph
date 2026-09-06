import { useState, useEffect } from 'react';
import { FolderOpen, Cpu, ArrowRight, AlertTriangle, Loader2, Play, CheckCircle2, Info } from 'lucide-react';
import { FolderPicker } from '@/shared/ui/FolderPicker';
import { FRAMEWORKS } from '@/entities/migration';
import type { DetectedTech } from '@/entities/migration';

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
  const [detectError, setDetectError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetPath) {
      setDetectedTech(null);
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
        if (data.primary) {
          setFromFw(data.primary);
        } else {
          setFromFw('');
          setDetectError('No supported framework detected in this directory.');
        }
      } catch (err: any) {
        setDetectError(err.message);
      } finally {
        setDetecting(false);
      }
    };
    detect();
  }, [targetPath]);

  const selectedFromGroup = FRAMEWORKS.find(f => f.value === fromFw)?.group;
  const compatibleToFrameworks = FRAMEWORKS.filter(f => f.group === selectedFromGroup && f.value !== fromFw);

  useEffect(() => {
    if (!fromFw) {
      setToFw('');
      return;
    }
    if (!compatibleToFrameworks.find(f => f.value === toFw)) {
      if (compatibleToFrameworks.length > 0) {
         setToFw(compatibleToFrameworks[0].value);
      } else {
         setToFw('');
      }
    }
  }, [fromFw, compatibleToFrameworks, toFw]);

  const hasHighConfidence = detectedTech && detectedTech.length > 0 && detectedTech[0].confidence > 50;
  const canLaunch = fromFw && toFw && !detectError && !isStarting;

  return (
    <div className="neo-card border-dashed max-w-6xl mx-auto w-full p-6 md:p-8 relative overflow-hidden flex flex-col gap-6">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neo-primary/10 via-transparent to-transparent opacity-50 pointer-events-none"></div>

      <div className="text-center relative z-10">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-widest mb-1">Launch Migration</h2>
        <p className="font-bold text-xs md:text-sm text-neo-text/60 uppercase tracking-wider">Configure your AI transformation swarm</p>
      </div>

      <div className="w-full relative z-30 flex flex-col items-center">
        {/* STEP 1: WORKSPACE */}
        <div className="w-full max-w-3xl space-y-3">
          <h3 className="font-black text-lg uppercase tracking-widest flex items-center gap-2 border-b-2 border-neo-border pb-1">
            <FolderOpen size={20} className="text-yellow-500" /> 1. Select Workspace
          </h3>
          <FolderPicker value={targetPath} onChange={setTargetPath} />
          
          {/* BANNER DE DETECCIÓN */}
          {targetPath && (
            <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">
              {detecting ? (
                <div className="p-4 border-2 border-neo-border bg-neo-primary/10 flex items-center justify-center gap-3 font-mono font-bold text-neo-primary animate-pulse">
                  <Loader2 size={18} className="animate-spin" /> SCANNING DIRECTORY FOR FRAMEWORKS...
                </div>
              ) : detectError ? (
                <div className="p-4 border-2 border-red-500 bg-red-100 flex items-center justify-center gap-3 font-mono font-bold text-red-700 shadow-[4px_4px_0px_0px_#ef4444]">
                  <AlertTriangle size={18} /> {detectError}
                </div>
              ) : hasHighConfidence && detectedTech ? (
                <div className="p-4 border-2 border-green-500 bg-green-100 flex flex-col md:flex-row items-center justify-between gap-3 font-mono font-bold text-green-800 shadow-[4px_4px_0px_0px_#22c55e]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} /> DETECTED: {detectedTech[0].framework.toUpperCase()}
                  </div>
                  <div className="text-xs opacity-70">
                    EVIDENCE: {detectedTech[0].evidence[0]}
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
          )}
        </div>
      </div>

      {/* STEP 2: TECHNOLOGY STACK */}
      <div className={`w-full relative z-10 transition-all duration-500 ${targetPath && !detectError && !detecting ? 'opacity-100 translate-y-0' : 'opacity-30 pointer-events-none translate-y-4'}`}>
        <h3 className="font-black text-lg uppercase tracking-widest mb-4 flex items-center justify-center gap-2 border-b-2 border-neo-border pb-1 max-w-3xl mx-auto">
          <Cpu size={20} className="text-blue-500" /> 2. Technology Stack
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-5xl mx-auto">
          
          {/* Select FROM */}
          <div className="flex flex-col gap-2">
            <label className="font-bold text-xs uppercase tracking-widest text-neo-text/60 text-center">Origin Framework</label>
            <div className="relative">
              <select
                value={fromFw}
                onChange={e => setFromFw(e.target.value)}
                disabled={hasHighConfidence || detecting}
                className={`w-full p-4 pl-12 border-4 border-neo-border font-mono text-base shadow-[4px_4px_0px_0px_var(--neo-shadow)] focus:outline-none focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all appearance-none text-center ${
                  hasHighConfidence ? 'bg-neo-text/10 cursor-not-allowed font-black' : 'bg-white cursor-pointer'
                }`}
              >
                <option value="" disabled>Select source...</option>
                {FRAMEWORKS.map(fw => (
                  <option key={fw.value} value={fw.value}>{fw.label}</option>
                ))}
              </select>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none w-6 h-6">
                <img src={FRAMEWORKS.find(f => f.value === fromFw)?.icon} className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            </div>
          </div>

          {/* ANIMATION CENTER */}
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-4 py-4 bg-neo-text/5 border-2 border-neo-border border-dashed rounded-lg w-full shadow-inner relative overflow-hidden">
               {/* Flying bits animation (CSS only placeholder logic) */}
               <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-neo-primary to-transparent animate-pulse"></div>
               </div>
               
               <div className="z-10 w-20 h-20 bg-white border-4 border-neo-border shadow-[4px_4px_0px_0px_var(--neo-shadow)] flex items-center justify-center rounded p-3 transition-transform hover:scale-110 bg-grid-pattern">
                 <img src={FRAMEWORKS.find(f => f.value === fromFw)?.icon} alt={fromFw} className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
               </div>
               
               <div className="z-10 flex flex-col items-center px-2">
                 <div className="flex items-center gap-1 text-neo-primary animate-pulse">
                   <div className="h-1 w-2 bg-neo-primary"></div>
                   <div className="h-1 w-2 bg-neo-primary"></div>
                   <div className="h-1 w-2 bg-neo-primary"></div>
                   <ArrowRight size={28} className="ml-1" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-neo-text/40 mt-1">Transform</span>
               </div>

               <div className="z-10 w-20 h-20 bg-white border-4 border-neo-border shadow-[4px_4px_0px_0px_var(--neo-shadow)] flex items-center justify-center rounded p-3 transition-transform hover:scale-110 bg-grid-pattern">
                 <img key={toFw} src={FRAMEWORKS.find(f => f.value === toFw)?.icon} alt={toFw} className="w-full h-full object-contain animate-in zoom-in duration-300" onError={(e) => (e.currentTarget.style.display = 'none')} />
               </div>
            </div>
          </div>

          {/* Select TO */}
          <div className="flex flex-col gap-2">
            <label className="font-bold text-xs uppercase tracking-widest text-neo-text/60 text-center">Target Framework</label>
            <div className="relative">
              <select
                value={toFw}
                onChange={e => setToFw(e.target.value)}
                disabled={!fromFw || detecting}
                className="w-full p-4 pl-12 border-4 border-neo-border font-mono text-base bg-white shadow-[4px_4px_0px_0px_var(--neo-shadow)] focus:outline-none focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
              >
                <option value="" disabled>Select target...</option>
                {compatibleToFrameworks.map(fw => (
                  <option key={fw.value} value={fw.value}>{fw.label}</option>
                ))}
              </select>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none w-6 h-6">
                  <img src={FRAMEWORKS.find(f => f.value === toFw)?.icon} className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STEP 3: ACTION */}
      <div className="w-full flex flex-col items-center relative z-10 pt-4">
        {startError && (
          <div className="bg-red-100 border-4 border-red-500 p-4 mb-6 w-full max-w-lg text-red-900 font-bold text-sm text-center shadow-[4px_4px_0px_0px_#ef4444] animate-in slide-in-from-bottom-2">
            <AlertTriangle size={24} className="mx-auto mb-2" />
            {startError}
          </div>
        )}

        <button
          onClick={() => onStart(targetPath, fromFw, toFw)}
          disabled={!canLaunch}
          className={`w-full max-w-2xl border-4 border-black text-white flex items-center justify-center gap-4 text-xl md:text-2xl py-4 font-black uppercase tracking-widest transition-all duration-300 ${
            canLaunch 
              ? 'bg-neo-primary hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none shadow-[8px_8px_0px_0px_#000]' 
              : 'bg-neo-text/50 opacity-50 cursor-not-allowed shadow-[8px_8px_0px_0px_#000]'
          }`}
        >
          {isStarting ? (
            <><Loader2 size={32} className="animate-spin" /> DISPATCHING SWARM...</>
          ) : (
            <><Play size={32} /> LAUNCH METAMORPH SWARM</>
          )}
        </button>
      </div>
    </div>
  );
};
