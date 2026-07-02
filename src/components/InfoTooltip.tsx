import { useState } from 'react';
import { Info } from 'lucide-react';

export function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        className="text-slate-300 hover:text-slate-500 transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        <Info size={12} />
      </button>
      {show && (
        <div className="absolute left-5 top-0 w-64 bg-slate-800 text-white text-[11px] rounded-xl p-3 z-50 shadow-xl leading-relaxed whitespace-normal">
          {text}
        </div>
      )}
    </div>
  );
}
