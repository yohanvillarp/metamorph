import { useState } from 'react';
import { WifiOff, Terminal, RefreshCw } from 'lucide-react';

interface ServerOfflineBannerProps {
  onRetry: () => Promise<void>;
}

export const ServerOfflineBanner = ({ onRetry }: ServerOfflineBannerProps) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="mb-6 p-4 border-4 border-neo-border bg-red-400 text-black shadow-[4px_4px_0px_0px_var(--neo-text)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <WifiOff size={22} className="text-red-950 flex-shrink-0 animate-pulse" />
            <h2 className="font-black uppercase tracking-widest text-sm text-red-950">
              Server Disconnected — CLI Process Offline
            </h2>
          </div>
          <p className="font-bold text-sm leading-relaxed text-red-950">
            Lost connection to the local Metamorph server on http://localhost:9876. The terminal process was closed, crashed, or stopped.
          </p>
          <div className="flex items-center gap-2 text-xs font-semibold text-red-950 bg-red-300/90 p-2 border-2 border-red-950/20">
            <Terminal size={14} className="flex-shrink-0" />
            <span>
              To restore connection, run in your terminal:{' '}
              <code className="font-mono font-bold bg-white text-black px-1.5 py-0.5 border border-red-900">
                metamorph ui
              </code>
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 self-start md:self-center">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="neo-btn font-black text-xs uppercase px-4 py-2.5 bg-white hover:bg-yellow-300 text-black border-2 border-neo-border flex items-center gap-2 shadow-[2px_2px_0px_0px_var(--neo-text)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
          >
            <RefreshCw size={14} className={isRetrying ? 'animate-spin' : ''} />
            {isRetrying ? 'Reconnecting...' : 'Retry Connection'}
          </button>
        </div>
      </div>
    </div>
  );
};
