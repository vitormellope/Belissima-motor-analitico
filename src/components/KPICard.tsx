import { useState } from 'react';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fmtCurrency, fmtPercent } from '../utils/analytics';

interface Props {
  label: string;
  value: number;
  previousValue?: number;
  variation?: number;
  format: 'currency' | 'number' | 'percent';
  tooltip: string;
  accent?: string;
  bgColor?: string;
  icon?: React.ReactNode;
  /** Substitui a renderização numérica do valor por conteúdo customizado */
  display?: React.ReactNode;
}

export function KPICard({
  label,
  value,
  variation,
  format: fmt,
  tooltip,
  accent = 'text-rose-600',
  bgColor = 'bg-white',
  icon,
  display,
}: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  const displayValue =
    fmt === 'currency'
      ? fmtCurrency(value)
      : fmt === 'percent'
      ? `${value.toFixed(1)}%`
      : value.toLocaleString('pt-BR');

  const variationDir =
    variation === undefined
      ? null
      : variation > 0.5
      ? 'up'
      : variation < -0.5
      ? 'down'
      : 'neutral';

  return (
    <div className={`${bgColor} rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          {icon && <span className={`${accent}`}>{icon}</span>}
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        </div>
        <div className="relative">
          <button
            className="text-slate-300 hover:text-slate-500 transition-colors"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info size={14} />
          </button>
          {showTooltip && (
            <div className="absolute right-0 top-6 w-56 bg-slate-800 text-white text-xs rounded-xl p-3 z-50 shadow-lg leading-relaxed">
              {tooltip}
            </div>
          )}
        </div>
      </div>

      <div>
        {display ?? <p className={`text-2xl font-bold ${accent} leading-none`}>{displayValue}</p>}
      </div>

      {variationDir !== null && variation !== undefined && (
        <div className="flex items-center gap-1.5">
          {variationDir === 'up' ? (
            <TrendingUp size={14} className="text-emerald-500" />
          ) : variationDir === 'down' ? (
            <TrendingDown size={14} className="text-red-500" />
          ) : (
            <Minus size={14} className="text-slate-400" />
          )}
          <span
            className={`text-xs font-semibold ${
              variationDir === 'up'
                ? 'text-emerald-600'
                : variationDir === 'down'
                ? 'text-red-500'
                : 'text-slate-400'
            }`}
          >
            {fmtPercent(variation)} vs período anterior
          </span>
        </div>
      )}
    </div>
  );
}
