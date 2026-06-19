import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, X } from 'lucide-react';

interface Props {
  label: string;
  sublabel: string;
  accent: string;
  bgAccent: string;
  borderAccent: string;
  fileName?: string;
  onFile: (file: File) => void;
  onClear: () => void;
  loading?: boolean;
}

export function UploadZone({
  label,
  sublabel,
  accent,
  bgAccent,
  borderAccent,
  fileName,
  onFile,
  onClear,
  loading,
}: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  if (fileName) {
    return (
      <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border-2 ${borderAccent} ${bgAccent}`}>
        <FileSpreadsheet size={24} className={accent} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">{label}</p>
          <p className="text-xs text-slate-500 truncate">{fileName}</p>
        </div>
        <CheckCircle size={18} className="text-emerald-500 shrink-0" />
        <button
          onClick={onClear}
          className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <label
      className={`flex flex-col items-center gap-2 px-6 py-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all
        ${dragging ? `${borderAccent} ${bgAccent}` : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleChange} />
      {loading ? (
        <div className="w-6 h-6 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
      ) : (
        <Upload size={22} className={dragging ? accent : 'text-slate-400'} />
      )}
      <div className="text-center">
        <p className={`text-sm font-semibold ${dragging ? accent : 'text-slate-600'}`}>{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
      </div>
    </label>
  );
}
