import { AlertTriangle, Info } from 'lucide-react';
import { useAlertStore } from '../store/alertStore';

export function GlobalAlert() {
  const { isOpen, type, title, message, close } = useAlertStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neo-bg border-4 border-neo-border w-full max-w-2xl shadow-[8px_8px_0px_0px_var(--neo-text)] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-neo-primary border-b-4 border-neo-border p-4 flex items-center gap-3">
          {type === 'alert' ? <Info className="text-neo-bg" size={28} /> : <AlertTriangle className="text-neo-bg" size={28} />}
          <h2 className="text-2xl font-black text-neo-bg uppercase tracking-wide">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="p-6 bg-neo-bg border-b-4 border-neo-border max-h-[60vh] overflow-y-auto">
          <div className="text-lg text-neo-text leading-relaxed">
            {message}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-neo-bg flex items-center justify-end gap-4">
          {type === 'confirm' && (
            <button
              onClick={() => close(false)}
              className="px-6 py-2 bg-gray-200 border-4 border-neo-border font-black text-lg text-neo-text shadow-[4px_4px_0px_0px_var(--neo-text)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--neo-text)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all uppercase"
            >
              Cancel
            </button>
          )}
          
          <button
            onClick={() => close(true)}
            className={`px-6 py-2 border-4 border-neo-border font-black text-lg text-neo-text shadow-[4px_4px_0px_0px_var(--neo-text)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--neo-text)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all uppercase ${
              type === 'alert' ? 'bg-green-400 hover:bg-green-500' : 'bg-red-400 hover:bg-red-500 text-white'
            }`}
          >
            {type === 'alert' ? 'Understood' : 'Confirm'}
          </button>
        </div>

      </div>
    </div>
  );
}
