import { useEffect, useState, useMemo } from 'react';
import { FilePlus, FileX, FileEdit, FileCode, ChevronRight } from 'lucide-react';
import { apiClient } from '@/shared/api/apiClient';
import type { ShadowFileEntry } from '@/shared/api/types';

interface DiffViewerProps {
  runId: string;
}

const STATUS_CONFIG = {
  added: { icon: FilePlus, label: 'Added', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-300', lineBg: 'bg-green-100' },
  modified: { icon: FileEdit, label: 'Modified', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', lineBg: '' },
  deleted: { icon: FileX, label: 'Deleted', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', lineBg: 'bg-red-100' },
} as const;

function computeUnifiedDiff(original: string | null, modified: string | null): Array<{ type: 'context' | 'added' | 'removed'; lineNum: number; content: string }> {
  const origLines = original ? original.split('\n') : [];
  const modLines = modified ? modified.split('\n') : [];

  if (!original && modified) {
    return modLines.map((line, i) => ({ type: 'added', lineNum: i + 1, content: line }));
  }
  if (original && !modified) {
    return origLines.map((line, i) => ({ type: 'removed', lineNum: i + 1, content: line }));
  }

  // Simple line-by-line diff with context
  const result: Array<{ type: 'context' | 'added' | 'removed'; lineNum: number; content: string }> = [];

  let origIdx = 0;
  let modIdx = 0;

  while (origIdx < origLines.length || modIdx < modLines.length) {
    if (origIdx < origLines.length && modIdx < modLines.length && origLines[origIdx] === modLines[modIdx]) {
      result.push({ type: 'context', lineNum: modIdx + 1, content: modLines[modIdx] });
      origIdx++;
      modIdx++;
    } else {
      // Find next matching line
      let foundOrig = -1;
      let foundMod = -1;
      const lookAhead = 10;

      for (let i = 1; i <= lookAhead; i++) {
        if (modIdx + i < modLines.length && origIdx < origLines.length && modLines[modIdx + i] === origLines[origIdx]) {
          foundMod = modIdx + i;
          break;
        }
        if (origIdx + i < origLines.length && modIdx < modLines.length && origLines[origIdx + i] === modLines[modIdx]) {
          foundOrig = origIdx + i;
          break;
        }
      }

      if (foundMod > -1) {
        // Lines were added
        while (modIdx < foundMod) {
          result.push({ type: 'added', lineNum: modIdx + 1, content: modLines[modIdx] });
          modIdx++;
        }
      } else if (foundOrig > -1) {
        // Lines were removed
        while (origIdx < foundOrig) {
          result.push({ type: 'removed', lineNum: origIdx + 1, content: origLines[origIdx] });
          origIdx++;
        }
      } else {
        // Changed line
        if (origIdx < origLines.length) {
          result.push({ type: 'removed', lineNum: origIdx + 1, content: origLines[origIdx] });
          origIdx++;
        }
        if (modIdx < modLines.length) {
          result.push({ type: 'added', lineNum: modIdx + 1, content: modLines[modIdx] });
          modIdx++;
        }
      }
    }
  }

  return result;
}

export const DiffViewer = ({ runId }: DiffViewerProps) => {
  const [files, setFiles] = useState<ShadowFileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<{ original: string | null; modified: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedFile(null);
    setDiffData(null);
    setLoading(true);
    setError(null);
    apiClient.getShadowFiles(runId)
      .then((res) => {
        setFiles(res.files);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [runId]);

  useEffect(() => {
    if (!selectedFile) {
      setDiffData(null);
      return;
    }
    setDiffLoading(true);
    apiClient.getShadowDiff(runId, selectedFile)
      .then((res) => {
        setDiffData({ original: res.original, modified: res.modified });
        setDiffLoading(false);
      })
      .catch(() => {
        setDiffData(null);
        setDiffLoading(false);
      });
  }, [runId, selectedFile]);

  const grouped = useMemo(() => {
    const groups: Record<string, ShadowFileEntry[]> = { added: [], modified: [], deleted: [] };
    for (const f of files) {
      groups[f.status].push(f);
    }
    return groups;
  }, [files]);

  const diffLines = useMemo(() => {
    if (!diffData) return [];
    return computeUnifiedDiff(diffData.original, diffData.modified);
  }, [diffData]);

  const stats = useMemo(() => ({
    added: grouped.added.length,
    modified: grouped.modified.length,
    deleted: grouped.deleted.length,
    total: files.length,
  }), [grouped, files]);

  if (loading) {
    return (
      <section className="neo-card p-8 text-center">
        <p className="font-bold text-neo-text/60">Loading shadow workspace files...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="neo-card p-8 text-center">
        <p className="font-bold text-red-600">{error}</p>
        <p className="text-sm text-neo-text/50 mt-2">The shadow workspace may have been cleaned up or the run ID is invalid.</p>
      </section>
    );
  }

  if (files.length === 0) {
    return (
      <section className="neo-card p-8 text-center">
        <p className="font-bold text-neo-text/60">No file changes found in shadow workspace.</p>
      </section>
    );
  }

  return (
    <section className="neo-card p-0 overflow-hidden flex flex-col animate-in fade-in duration-300">
      <div className="p-4 sm:p-5 border-b-2 border-neo-border">
        <h2 className="neo-title flex items-center gap-2 mb-1">
          <FileCode /> Shadow Workspace Diff
        </h2>
        <div className="flex gap-4 mt-2">
          <span className="text-xs font-bold">
            <span className="text-green-700">{stats.added} added</span>
            {' / '}
            <span className="text-yellow-700">{stats.modified} modified</span>
            {' / '}
            <span className="text-red-700">{stats.deleted} deleted</span>
            {' / '}
            <span className="text-neo-text/60">{stats.total} total</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[500px]">
        {/* File tree sidebar */}
        <div className="lg:w-80 border-b-2 lg:border-b-0 lg:border-r-2 border-neo-border overflow-y-auto max-h-[600px]">
          {(['modified', 'added', 'deleted'] as const).map((status) => {
            const group = grouped[status];
            if (group.length === 0) return null;
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            return (
              <div key={status}>
                <div className={`px-4 py-2 ${cfg.bg} border-b-2 border-neo-border`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>
                    <Icon size={12} className="inline mr-1" />
                    {cfg.label} ({group.length})
                  </span>
                </div>
                {group.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedFile(f.path)}
                    className={`w-full text-left px-4 py-2 text-sm font-mono border-b border-neo-border/50 hover:bg-yellow-50 flex items-center gap-2 ${
                      selectedFile === f.path ? 'bg-neo-primary/10 font-bold' : ''
                    }`}
                  >
                    <ChevronRight size={12} className={selectedFile === f.path ? 'text-neo-primary' : 'text-neo-text/30'} />
                    <span className="truncate">{f.path}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Diff content area */}
        <div className="flex-1 overflow-auto">
          {!selectedFile && (
            <div className="p-8 text-center text-neo-text/50 font-bold">
              Select a file to view its diff
            </div>
          )}

          {selectedFile && diffLoading && (
            <div className="p-8 text-center text-neo-text/50 font-bold">
              Loading diff...
            </div>
          )}

          {selectedFile && !diffLoading && diffData && (
            <div className="font-mono text-[13px] leading-relaxed">
              <div className="px-4 py-2 bg-gray-100 border-b-2 border-neo-border font-bold text-sm">
                {selectedFile}
              </div>
              <div className="overflow-x-auto">
                {diffLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      line.type === 'added' ? 'bg-green-100' :
                      line.type === 'removed' ? 'bg-red-100' :
                      ''
                    }`}
                  >
                    <span className="w-12 shrink-0 text-right pr-2 text-[11px] text-neo-text/40 select-none border-r border-neo-border/30 py-px">
                      {line.lineNum}
                    </span>
                    <span className={`w-6 shrink-0 text-center select-none py-px ${
                      line.type === 'added' ? 'text-green-700 font-bold' :
                      line.type === 'removed' ? 'text-red-700 font-bold' :
                      'text-neo-text/20'
                    }`}>
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <pre className="flex-1 px-2 py-px whitespace-pre overflow-x-visible">
                      {line.content || ' '}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
