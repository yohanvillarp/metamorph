import { useState } from 'react';
import { Folder, FolderOpen, ChevronRight, ArrowUp, FileCode2, Check, Loader2 } from 'lucide-react';

const API_BASE = '';

interface BrowseEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface BrowseResult {
  current: string;
  parent: string;
  entries: BrowseEntry[];
}

interface FolderPickerProps {
  value: string;
  onChange: (path: string) => void;
}

export const FolderPicker = ({ value, onChange }: FolderPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [browsing, setBrowsing] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);

  const browse = async (path?: string) => {
    setLoading(true);
    try {
      const url = path
        ? `${API_BASE}/api/browse?path=${encodeURIComponent(path)}`
        : `${API_BASE}/api/browse`;
      const res = await fetch(url);
      const data = await res.json();
      setBrowsing(data);
    } catch (err) {
      console.error('Browse failed', err);
    } finally {
      setLoading(false);
    }
  };

  const openPicker = () => {
    setIsOpen(true);
    browse(value || undefined);
  };

  const selectFolder = (path: string) => {
    onChange(path);
    setIsOpen(false);
  };

  return (
    <div>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={openPicker}
        className="w-full p-3 border-4 border-neo-border font-mono text-sm bg-white shadow-[4px_4px_0px_0px_var(--neo-shadow)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-3 text-left"
      >
        <FolderOpen size={18} className="text-yellow-500 shrink-0" />
        <span className="truncate flex-1">{value || 'Select a folder...'}</span>
        <ChevronRight size={16} className="text-neo-text/40" />
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-8">
          <div className="neo-card w-full max-w-lg max-h-[70vh] flex flex-col bg-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b-4 border-neo-border pb-3 mb-3">
              <h3 className="font-black uppercase tracking-widest text-sm">Select Folder</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="neo-btn text-xs px-3 py-1"
              >
                ✕
              </button>
            </div>

            {/* Current Path */}
            {browsing && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-neo-text/5 border-2 border-neo-border font-mono text-xs overflow-hidden">
                <Folder size={14} className="text-yellow-500 shrink-0" />
                <span className="truncate flex-1" title={browsing.current}>{browsing.current}</span>
              </div>
            )}

            {/* Actions */}
            {browsing && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => browse(browsing.parent)}
                  className="neo-btn text-xs flex items-center gap-1 px-3 py-1"
                >
                  <ArrowUp size={14} /> Up
                </button>
                <button
                  onClick={() => selectFolder(browsing.current)}
                  className="neo-btn text-xs flex items-center gap-1 px-3 py-1 bg-green-400 text-black ml-auto"
                >
                  <Check size={14} /> Use This Folder
                </button>
              </div>
            )}

            {/* Entry List */}
            <div className="flex-1 overflow-y-auto border-2 border-neo-border">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 size={24} className="animate-spin text-neo-text/40" />
                </div>
              ) : (
                browsing?.entries.map((entry) => (
                  <button
                    key={entry.path}
                    onClick={() => {
                      if (entry.isDirectory) browse(entry.path);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-mono border-b border-neo-border/30 last:border-0 transition-colors ${
                      entry.isDirectory
                        ? 'hover:bg-yellow-50 cursor-pointer'
                        : 'opacity-40 cursor-default'
                    }`}
                  >
                    {entry.isDirectory ? (
                      <Folder size={16} className="text-yellow-500 shrink-0" />
                    ) : (
                      <FileCode2 size={16} className="text-neo-text/30 shrink-0" />
                    )}
                    <span className="truncate">{entry.name}</span>
                    {entry.isDirectory && (
                      <ChevronRight size={14} className="text-neo-text/30 ml-auto shrink-0" />
                    )}
                  </button>
                ))
              )}
              {browsing?.entries.length === 0 && !loading && (
                <p className="p-4 text-center text-sm font-bold text-neo-text/40">Empty directory</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
