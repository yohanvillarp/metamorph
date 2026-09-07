import { useState, useEffect } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';

interface NextStepsViewerProps {
  message: string;
  gitUsed: boolean;
  branch?: string;
  targetPath: string;
}

export function NextStepsViewer({ message, gitUsed, branch, targetPath }: NextStepsViewerProps) {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Reveal step 1 after 300ms, step 2 after 800ms
    const t1 = setTimeout(() => setStep(1), 300);
    const t2 = setTimeout(() => setStep(2), 800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const commands = gitUsed
    ? `cd ${targetPath}\ngit fetch\ngit checkout ${branch}\nnpm install`
    : `cd ${targetPath}\nnpm install`;

  const handleCopy = () => {
    navigator.clipboard.writeText(commands);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Step 1: Status Message */}
      <div className={`transition-all duration-500 ease-out transform ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="flex items-start gap-3 bg-neo-primary/10 p-3 sm:p-4 border-2 border-neo-primary rounded-sm">
          <CheckCircle2 className="text-neo-primary mt-1 shrink-0" />
          <p className="text-neo-text font-medium leading-relaxed break-words min-w-0">{message} Read MIGRATION.md in the project for a summary of what changed.</p>
        </div>
      </div>

      {/* Step 2: Next Steps Codeblock */}
      <div className={`transition-all duration-500 ease-out transform ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <p className="font-bold text-base sm:text-lg mb-3">Next steps:</p>
        
        <div className="relative">
          <pre className="bg-neo-border p-4 pr-14 font-mono text-xs sm:text-sm text-neo-bg overflow-x-auto whitespace-pre-wrap break-all rounded-sm shadow-inner">
            {commands}
          </pre>
          
          <button 
            onClick={handleCopy}
            title="Copy commands"
            className="absolute top-2 right-2 p-2 bg-neo-bg text-neo-text border-2 border-neo-border rounded-sm hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center shadow-[2px_2px_0px_0px_var(--neo-text)]"
          >
            {copied ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
