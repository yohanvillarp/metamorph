import { useMemo } from 'react';
import { FileCode2, UserCircle2, CheckCircle2, Play, Search } from 'lucide-react';

export const SwarmSwimlanes = ({ events }: { events: any[] }) => {
  // Aggregate events by file path
  const files = useMemo(() => {
    const fileMap = new Map<string, {
      path: string;
      stage: 'discovered' | 'migrating' | 'reviewing' | 'approved';
      mapperId?: string;
      workerId?: string;
      reviewerId?: string;
    }>();

    // Process oldest to newest so we don't overwrite final states with older ones
    [...events].reverse().forEach(evt => {
      const payload = evt.payload;
      if (!payload?.filePath) return;

      const path = payload.filePath.split('\\').pop() || payload.filePath.split('/').pop() || payload.filePath;
      const pid = payload.producerId;
      const name = evt.eventName.toLowerCase();

      if (!fileMap.has(path)) {
        fileMap.set(path, { path, stage: 'discovered' });
      }
      
      const file = fileMap.get(path)!;

      if (name.includes('discover')) {
        file.mapperId = pid;
        if (file.stage === 'discovered') file.stage = 'migrating'; // Worker picks it up immediately in our architecture
      } else if (name.includes('migrat') && !name.includes('started')) {
        file.workerId = pid;
        file.stage = 'reviewing';
      } else if (name.includes('review') || name.includes('approve') || name.includes('reject')) {
        file.reviewerId = pid;
        file.stage = 'approved';
      }
    });

    return Array.from(fileMap.values());
  }, [events]);

  if (files.length === 0) {
    return (
      <div className="neo-card h-64 flex flex-col items-center justify-center text-center">
        <Play size={48} className="text-neo-text/30 mb-4" />
        <h3 className="font-black text-2xl uppercase text-neo-text/50">Waiting for Swarm...</h3>
        <p className="font-bold text-neo-text/50">Start a migration in the CLI</p>
      </div>
    );
  }

  return (
    <div className="neo-card p-0 overflow-hidden bg-neo-surface">
      <div className="grid grid-cols-4 border-b-4 border-neo-border bg-white font-black text-sm uppercase tracking-widest">
        <div className="p-4 border-r-4 border-neo-border flex items-center gap-2"><Search size={18} className="text-yellow-500" /> Discovered</div>
        <div className="p-4 border-r-4 border-neo-border flex items-center gap-2"><Play size={18} className="text-blue-500" /> Migrating</div>
        <div className="p-4 border-r-4 border-neo-border flex items-center gap-2"><UserCircle2 size={18} className="text-purple-500" /> Reviewing</div>
        <div className="p-4 flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Approved</div>
      </div>

      <div className="flex flex-col">
        {files.map((file, idx) => (
          <div key={file.path} className={`grid grid-cols-4 border-b-4 border-neo-border last:border-b-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-neo-surface'}`}>
            
            {/* File Info / Discovered */}
            <div className="p-4 border-r-4 border-neo-border flex flex-col justify-center gap-2 relative">
              <div className="font-bold font-mono text-sm break-all flex items-start gap-2">
                <FileCode2 size={16} className="shrink-0 mt-0.5" />
                {file.path}
              </div>
              {file.mapperId && (
                <div className="mt-2 text-xs font-black uppercase text-yellow-600 bg-yellow-100 border-2 border-yellow-400 p-1 px-2 rounded-full inline-flex w-fit">
                  Mapper
                </div>
              )}
            </div>

            {/* Migrating Column */}
            <div className="p-4 border-r-4 border-neo-border relative">
              {['migrating', 'reviewing', 'approved'].includes(file.stage) && (
                <div className="animate-in zoom-in spin-in-1 duration-300 w-full h-full min-h-[80px] bg-blue-200 border-4 border-blue-500 p-3 flex flex-col justify-center items-center text-center neo-card shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
                  <span className="font-black uppercase text-blue-900 tracking-wider">Worker</span>
                  <span className="font-mono text-[10px] text-blue-800 mt-1 truncate w-full px-2" title={file.workerId}>{file.workerId?.split('-').pop()?.substring(0,8) || 'working...'}</span>
                </div>
              )}
            </div>

            {/* Reviewing Column */}
            <div className="p-4 border-r-4 border-neo-border relative">
              {['reviewing', 'approved'].includes(file.stage) && (
                <div className="animate-in zoom-in spin-in-1 duration-300 w-full h-full min-h-[80px] bg-purple-200 border-4 border-purple-500 p-3 flex flex-col justify-center items-center text-center neo-card shadow-[4px_4px_0px_0px_rgba(168,85,247,1)]">
                  <span className="font-black uppercase text-purple-900 tracking-wider">Reviewer</span>
                  <span className="font-mono text-[10px] text-purple-800 mt-1 truncate w-full px-2" title={file.reviewerId}>{file.reviewerId?.split('-').pop()?.substring(0,8) || 'reviewing...'}</span>
                </div>
              )}
            </div>

            {/* Approved Column */}
            <div className="p-4 relative flex items-center justify-center">
              {file.stage === 'approved' && (
                <div className="animate-in zoom-in spin-in-1 duration-500 rounded-full bg-green-400 border-4 border-green-600 w-16 h-16 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(22,163,74,1)]">
                  <CheckCircle2 size={32} className="text-green-900" />
                </div>
              )}
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
};
