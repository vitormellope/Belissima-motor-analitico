import { useState } from 'react';
import type { PeriodType, PeriodMode } from '../types';
import { Calendar, ChevronDown, RefreshCw, GitCompare, Lock } from 'lucide-react';

// Só Ano e Personalizado ficam ativos; os demais entram travados com cadeado.
const PRESETS: { value: PeriodType; label: string; locked: boolean }[] = [
  { value: 'dia', label: 'Dia', locked: true },
  { value: 'semana', label: 'Semana', locked: true },
  { value: 'mes', label: 'Mês', locked: true },
  { value: 'trimestre', label: 'Trimestre', locked: true },
  { value: 'ano', label: 'Ano', locked: false },
];

// Semestre padrão do dashboard
const SEMESTER_START = '2026-01-01';
const SEMESTER_END = '2026-06-30';

interface Props {
  mode: PeriodMode;
  presetType: PeriodType;
  customStart: string;
  customEnd: string;
  compareStart: string;
  compareEnd: string;
  showComparison: boolean;
  onModeChange: (m: PeriodMode) => void;
  onPresetChange: (t: PeriodType) => void;
  onCustomChange: (start: string, end: string) => void;
  onCompareChange: (start: string, end: string) => void;
  onToggleComparison: () => void;
  currentLabel: string;
  compareLabel?: string;
}

export function PeriodFilter({
  mode, presetType, customStart, customEnd, compareStart, compareEnd,
  showComparison, onModeChange, onPresetChange, onCustomChange,
  onCompareChange, currentLabel, compareLabel,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex flex-wrap items-start gap-4">
        {/* Left: period info */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Período selecionado</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-800">{currentLabel}</p>
            {showComparison && compareLabel && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-violet-50 text-violet-600 border border-violet-200 rounded-full px-2 py-0.5 font-semibold">
                <GitCompare size={10} />
                vs {compareLabel}
              </span>
            )}
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset pills */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {PRESETS.map((opt) =>
              opt.locked ? (
                <span
                  key={opt.value}
                  title="Filtro bloqueado — disponível apenas Ano e Personalizado"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 text-slate-300 cursor-not-allowed select-none"
                >
                  <Lock size={10} />
                  {opt.label}
                </span>
              ) : (
                <button
                  key={opt.value}
                  onClick={() => { onModeChange('preset'); onPresetChange(opt.value); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'preset' && presetType === opt.value
                      ? 'bg-white text-rose-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              )
            )}
            <button
              onClick={() => { onModeChange('custom'); setOpen(true); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                mode === 'custom'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar size={11} />
              Personalizado
              <ChevronDown size={11} className={`transition-transform ${open && mode === 'custom' ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Custom date picker panel */}
      {mode === 'custom' && open && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Período 1 */}
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {showComparison ? 'Período 1' : 'Intervalo'}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 mb-0.5 block">Início</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => onCustomChange(e.target.value, customEnd)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-rose-400 text-slate-700"
                  />
                </div>
                <span className="text-slate-300 text-xs mt-4">→</span>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 mb-0.5 block">Fim</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => onCustomChange(customStart, e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-rose-400 text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Período 2 (comparison) */}
            {showComparison && (
              <div>
                <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-2">Período 2 (comparação)</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 mb-0.5 block">Início</label>
                    <input
                      type="date"
                      value={compareStart}
                      onChange={(e) => onCompareChange(e.target.value, compareEnd)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400 text-slate-700"
                    />
                  </div>
                  <span className="text-slate-300 text-xs mt-4">→</span>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 mb-0.5 block">Fim</label>
                    <input
                      type="date"
                      value={compareEnd}
                      onChange={(e) => onCompareChange(compareStart, e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400 text-slate-700"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            {customStart && customEnd && (
              <p className="text-[10px] text-slate-400">
                {Math.round((new Date(customEnd).getTime() - new Date(customStart).getTime()) / 86400000)} dias selecionados
              </p>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => onCustomChange(SEMESTER_START, SEMESTER_END)}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RefreshCw size={10} />
                Semestre (jan–jun 2026)
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-xs bg-rose-500 text-white px-4 py-1.5 rounded-xl hover:bg-rose-600 transition-colors font-semibold"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison period for preset mode */}
      {mode === 'preset' && showComparison && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-2">Período de comparação personalizado (opcional)</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 max-w-xs">
              <label className="text-[10px] text-slate-400 mb-0.5 block">Início</label>
              <input
                type="date"
                value={compareStart}
                onChange={(e) => onCompareChange(e.target.value, compareEnd)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400 text-slate-700"
              />
            </div>
            <span className="text-slate-300 text-xs mt-4">→</span>
            <div className="flex-1 max-w-xs">
              <label className="text-[10px] text-slate-400 mb-0.5 block">Fim</label>
              <input
                type="date"
                value={compareEnd}
                onChange={(e) => onCompareChange(compareStart, e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400 text-slate-700"
              />
            </div>
            {(compareStart || compareEnd) && (
              <button
                onClick={() => onCompareChange('', '')}
                className="text-xs text-slate-400 hover:text-slate-600 mt-4 px-2 py-1"
              >
                Limpar
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Se não preenchido, compara automaticamente com o período anterior equivalente.
          </p>
        </div>
      )}
    </div>
  );
}
