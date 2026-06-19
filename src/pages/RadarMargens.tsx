import { useMemo, useState } from 'react';
import type { Transaction } from '../types';
import { buildDRE } from '../utils/dreMapping';
import { fmtCurrency } from '../utils/analytics';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, FileText, Columns, CalendarDays } from 'lucide-react';

interface Props {
  saidas: Transaction[];
  entradas: Transaction[];
}

// ── Margens a exibir — nomenclatura idêntica ao DRE ─────────────────────────

const MARGIN_DEFS = [
  {
    linha: 5,
    label: 'Lucro Bruto',
    color: '#10b981',
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    tooltip: 'Linha 5 do DRE.\nFórmula: Receita Líquida (L3) − CMV (L4)\nMargem = Lucro Bruto ÷ Receita Bruta × 100\nRepresenta quanto sobra da receita após pagar o custo direto das mercadorias vendidas.',
  },
  {
    linha: 7,
    label: 'Lucro Operacional Bruto',
    color: '#3b82f6',
    bg: 'bg-blue-500',
    ring: 'ring-blue-200',
    tooltip: 'Linha 7 do DRE.\nFórmula: Lucro Bruto (L5) − OPEX (L6)\nMargem = Lucro Operacional Bruto ÷ Receita Bruta × 100\nMostra o resultado após descontar todas as despesas operacionais da loja (pessoal, aluguel, utilidades, etc.).',
  },
  {
    linha: 9,
    label: 'Lucro Operacional (EBITA)',
    color: '#8b5cf6',
    bg: 'bg-violet-500',
    ring: 'ring-violet-200',
    tooltip: 'Linha 9 do DRE.\nFórmula: Lucro Operacional Bruto (L7) − SG&A (L8)\nMargem = EBITA ÷ Receita Bruta × 100\nResultado antes de tributos e despesas financeiras. Mede a eficiência da operação completa.',
  },
  {
    linha: 12,
    label: 'Lucro Líquido',
    color: '#f59e0b',
    bg: 'bg-amber-500',
    ring: 'ring-amber-200',
    tooltip: 'Linha 12 do DRE.\nFórmula: EBITA (L9) − IR/CSLL (L10) − Despesas Financeiras (L11)\nMargem = Lucro Líquido ÷ Receita Bruta × 100\nLucro após todos os impostos e encargos financeiros.',
  },
  {
    linha: 17,
    label: 'Resultado do Mês',
    color: '#f43f5e',
    bg: 'bg-rose-500',
    ring: 'ring-rose-200',
    tooltip: 'Linha 17 do DRE.\nFórmula: Lucro Líquido (L12) − CAPEX (L13) − Dividendos (L14) − Outras Saídas (L16)\nMargem = Resultado ÷ Receita Bruta × 100\nResultado final do período, considerando todos os desembolsos incluindo investimentos e retiradas.',
  },
] as const;

// ── Tooltip do card ───────────────────────────────────────────────────────────

function InfoTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        className="text-current opacity-30 hover:opacity-70 text-[10px] cursor-help select-none leading-none"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        ⓘ
      </button>
      {open && (
        <span className="pointer-events-none absolute right-0 bottom-full mb-2 z-50 w-72 bg-slate-800 text-white text-[10px] rounded-xl px-3 py-2.5 leading-relaxed shadow-xl whitespace-pre-line">
          {content}
        </span>
      )}
    </span>
  );
}

// ── Cor do Δpp ────────────────────────────────────────────────────────────────

function deltaCls(delta: number | null): string {
  if (delta === null) return 'bg-slate-50 text-slate-300';
  if (delta >  5) return 'bg-emerald-500 text-white font-bold';
  if (delta >  2) return 'bg-emerald-200 text-emerald-800 font-semibold';
  if (delta > -2) return 'bg-slate-100 text-slate-500';
  if (delta > -5) return 'bg-rose-200 text-rose-800 font-semibold';
  return 'bg-rose-500 text-white font-bold';
}

function fmtDelta(delta: number | null): string {
  if (delta === null) return '—';
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}pp`;
}

// ── Tooltip do gráfico ────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 min-w-[200px]">
      <p className="text-xs font-bold text-slate-700 mb-2 capitalize">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="text-xs font-bold" style={{ color: p.color }}>
            {p.value.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function RadarMargens({ saidas, entradas }: Props) {
  const dre = useMemo(() => buildDRE(saidas, entradas), [saidas, entradas]);
  const [showDelta, setShowDelta]     = useState(false);
  const [filterFrom, setFilterFrom]   = useState('');
  const [filterTo, setFilterTo]       = useState('');

  const hasData = saidas.length > 0 || entradas.length > 0;

  // Receita Bruta por mês
  const receitaByMonth = useMemo(() =>
    dre.lines.find((l) => l.linha === 1)?.months ?? {},
    [dre],
  );

  // Meses filtrados pelo período selecionado
  const filteredKeys = useMemo(() => {
    let keys = dre.monthKeys;
    if (filterFrom) keys = keys.filter((mk) => mk >= filterFrom);
    if (filterTo)   keys = keys.filter((mk) => mk <= filterTo);
    return keys;
  }, [dre.monthKeys, filterFrom, filterTo]);

  const filteredLabels = useMemo(() =>
    filteredKeys.map((mk) => dre.monthLabels[dre.monthKeys.indexOf(mk)]),
    [filteredKeys, dre],
  );

  // Margens (%) por mês — null quando receita = 0
  const margensByMonth = useMemo(() => {
    const result: Record<string, Record<string, number | null>> = {};
    for (const mk of dre.monthKeys) {
      const rec = receitaByMonth[mk] ?? 0;
      result[mk] = {};
      for (const m of MARGIN_DEFS) {
        const val = dre.lines.find((l) => l.linha === m.linha)?.months[mk] ?? 0;
        result[mk][m.label] = rec > 0 ? (val / rec) * 100 : null;
      }
    }
    return result;
  }, [dre, receitaByMonth]);

  // Dados do gráfico (apenas meses filtrados com receita > 0)
  const chartData = useMemo(() =>
    filteredKeys
      .filter((mk) => (receitaByMonth[mk] ?? 0) > 0)
      .map((mk) => {
        const label = dre.monthLabels[dre.monthKeys.indexOf(mk)];
        const row: Record<string, number | string> = { name: label };
        for (const m of MARGIN_DEFS) {
          const pct = margensByMonth[mk]?.[m.label];
          row[m.label] = pct !== null && pct !== undefined ? parseFloat(pct.toFixed(1)) : 0;
        }
        return row;
      }),
    [filteredKeys, dre, margensByMonth, receitaByMonth],
  );

  // KPIs: último mês dentro do filtro que tenha receita > 0
  const kpiMk = useMemo(() =>
    [...filteredKeys].reverse().find((mk) => (receitaByMonth[mk] ?? 0) > 0) ?? null,
    [filteredKeys, receitaByMonth],
  );
  const kpiPrevMk = useMemo(() => {
    if (!kpiMk) return null;
    const idx = dre.monthKeys.indexOf(kpiMk);
    return idx > 0 ? dre.monthKeys[idx - 1] : null;
  }, [kpiMk, dre]);

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
        <TrendingUp size={40} className="text-slate-200" />
        <p className="text-sm font-semibold text-slate-500">Carregue as planilhas para visualizar as margens</p>
        <p className="text-xs text-slate-400 max-w-sm">
          Importe saídas e entradas. O sistema calculará as margens do DRE mês a mês.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Barra de controles */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Período:</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">De</label>
          <select
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300 text-slate-600 bg-white"
          >
            <option value="">Início</option>
            {dre.monthKeys.map((mk, i) => (
              <option key={mk} value={mk}>{dre.monthLabels[i]}</option>
            ))}
          </select>
          <label className="text-xs text-slate-400">até</label>
          <select
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300 text-slate-600 bg-white"
          >
            <option value="">Fim</option>
            {dre.monthKeys.map((mk, i) => (
              <option key={mk} value={mk}>{dre.monthLabels[i]}</option>
            ))}
          </select>
          {(filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterFrom(''); setFilterTo(''); }}
              className="text-[10px] text-rose-400 hover:text-rose-600 transition-colors px-1.5 py-0.5 rounded hover:bg-rose-50"
            >
              Limpar
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowDelta((v) => !v)}
            className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${showDelta ? 'bg-slate-100 border-slate-300 text-slate-600' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
          >
            <Columns size={11} />
            {showDelta ? 'Ocultar variação M/M' : 'Variação mês vs mês'}
          </button>
        </div>
        {filteredKeys.length > 0 && (
          <span className="text-[10px] text-slate-400">
            {filteredKeys.length} {filteredKeys.length === 1 ? 'mês' : 'meses'} exibidos
          </span>
        )}
      </div>

      {/* KPI cards — último mês com receita */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {MARGIN_DEFS.map((m) => {
          const pct      = kpiMk ? (margensByMonth[kpiMk]?.[m.label] ?? null) : null;
          const prevPct  = kpiPrevMk ? (margensByMonth[kpiPrevMk]?.[m.label] ?? null) : null;
          const delta    = pct !== null && prevPct !== null ? pct - prevPct : null;
          const lineVal  = kpiMk ? (dre.lines.find((l) => l.linha === m.linha)?.months[kpiMk] ?? 0) : 0;
          const kpiLabel = kpiMk ? dre.monthLabels[dre.monthKeys.indexOf(kpiMk)] : null;
          const valColor = lineVal >= 0 ? 'text-emerald-600' : 'text-rose-600';

          return (
            <div key={m.label} className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 ring-1 ${m.ring}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${m.bg} shrink-0`} />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight flex-1">{m.label}</p>
                <InfoTooltip content={m.tooltip} />
              </div>

              {/* % Margem */}
              <p className="text-2xl font-bold" style={{ color: pct !== null ? m.color : undefined }}>
                {pct !== null ? `${pct.toFixed(1)}%` : <span className="text-slate-300">—%</span>}
              </p>

              {/* Valor absoluto */}
              <p className={`text-[11px] font-semibold mt-0.5 ${kpiMk ? valColor : 'text-slate-300'}`}>
                {kpiMk ? fmtCurrency(lineVal) : '—'}
              </p>

              {/* Período de referência */}
              {kpiLabel && (
                <p className="text-[9px] text-slate-400 mt-0.5">{kpiLabel}</p>
              )}

              {/* Δpp */}
              {delta !== null ? (
                <p className={`text-[10px] font-semibold mt-1.5 ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}pp vs mês ant.
                </p>
              ) : prevPct === null && kpiPrevMk ? (
                <p className="text-[10px] text-slate-300 mt-1.5">sem receita no mês ant.</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Aviso quando não há receita */}
      {kpiMk === null && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
          <p className="text-xs text-amber-700 font-semibold">
            Nenhum dado de receita encontrado no período selecionado. Carregue a planilha de entradas para visualizar as margens.
          </p>
        </div>
      )}

      {/* Gráfico de linha */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-violet-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Evolução das Margens</h2>
            <span className="ml-auto text-[10px] text-slate-400">% sobre Receita Bruta do mês</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                width={40}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {MARGIN_DEFS.map((m) => (
                <Line
                  key={m.label}
                  type="monotone"
                  dataKey={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 4, fill: m.color, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela de margens mensais */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <FileText size={15} className="text-violet-500" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Margens por Mês</h2>
          <span className="ml-auto text-[10px] text-slate-400">
            Δpp = variação em pontos percentuais vs. mês anterior
          </span>
        </div>

        <div className="overflow-x-auto">
          <table
            className="text-xs border-collapse"
            style={{ minWidth: `${360 + filteredKeys.length * (showDelta ? 160 : 110)}px` }}
          >
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-4 text-slate-500 font-semibold sticky left-0 z-20 bg-slate-50 border-r border-slate-200 w-56">
                  Linha DRE
                </th>
                {filteredKeys.map((mk, i) => {
                  const globalIdx = dre.monthKeys.indexOf(mk);
                  return (
                    <>
                      <th key={mk} className="text-right py-2.5 px-4 text-amber-600 font-semibold min-w-[100px] capitalize border-l border-slate-100">
                        {filteredLabels[i]}
                      </th>
                      {showDelta && globalIdx > 0 && (
                        <th key={`delta-${mk}`} className="text-center py-2.5 px-2 text-slate-400 font-semibold w-20 border-l border-slate-100">
                          Δpp
                        </th>
                      )}
                    </>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {MARGIN_DEFS.map((m) => (
                <tr key={m.label} className="border-b border-slate-100/50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 sticky left-0 z-10 bg-white border-r border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                      <span className="font-semibold text-slate-700">{m.label}</span>
                      <InfoTooltip content={m.tooltip} />
                    </div>
                  </td>
                  {filteredKeys.map((mk) => {
                    const globalIdx  = dre.monthKeys.indexOf(mk);
                    const pct        = margensByMonth[mk]?.[m.label] ?? null;
                    const prevMkLocal = dre.monthKeys[globalIdx - 1];
                    const prevPct    = prevMkLocal != null ? (margensByMonth[prevMkLocal]?.[m.label] ?? null) : null;
                    const delta      = pct !== null && prevPct !== null ? pct - prevPct : null;
                    const lineVal    = dre.lines.find((l) => l.linha === m.linha)?.months[mk] ?? 0;
                    const rec        = receitaByMonth[mk] ?? 0;

                    return (
                      <>
                        <td key={mk} className="py-3 px-4 text-right border-l border-slate-100/50">
                          {rec > 0 && pct !== null ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-sm" style={{ color: m.color }}>
                                {pct.toFixed(1)}%
                              </span>
                              <span className={`text-[10px] ${lineVal >= 0 ? 'text-slate-500' : 'text-rose-500'}`}>
                                {fmtCurrency(lineVal)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        {showDelta && globalIdx > 0 && (
                          <td key={`delta-${mk}`} className="py-3 px-2 text-center border-l border-slate-100/30">
                            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-md ${deltaCls(delta)}`}>
                              {fmtDelta(delta)}
                            </span>
                          </td>
                        )}
                      </>
                    );
                  })}
                </tr>
              ))}

              {/* Receita Bruta — linha de referência */}
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="py-2.5 px-4 sticky left-0 z-10 bg-slate-50 border-r border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    Receita Bruta (base)
                  </span>
                </td>
                {filteredKeys.map((mk) => {
                  const globalIdx  = dre.monthKeys.indexOf(mk);
                  const rec        = receitaByMonth[mk] ?? 0;
                  const prevMkLocal = dre.monthKeys[globalIdx - 1];
                  const prevRec    = prevMkLocal != null ? (receitaByMonth[prevMkLocal] ?? 0) : null;
                  const delta      = prevRec != null && prevRec > 0 ? ((rec - prevRec) / prevRec) * 100 : null;
                  return (
                    <>
                      <td key={mk} className="py-2.5 px-4 text-right border-l border-slate-100/50">
                        <span className={`text-[10px] font-semibold ${rec > 0 ? 'text-slate-600' : 'text-slate-300'}`}>
                          {rec > 0 ? fmtCurrency(rec) : '—'}
                        </span>
                      </td>
                      {showDelta && globalIdx > 0 && (
                        <td key={`delta-${mk}`} className="py-2.5 px-2 text-center border-l border-slate-100/30">
                          {delta !== null ? (
                            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-md ${delta >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                            </span>
                          ) : <span className="text-slate-300 text-[10px]">—</span>}
                        </td>
                      )}
                    </>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-5 py-2.5 border-t border-slate-100 text-[10px] text-slate-400 bg-slate-50/50">
          Δpp = diferença em pontos percentuais da margem vs. mês anterior (ex.: 52% → 55% = +3pp) · % calculada sobre Receita Bruta de cada mês
        </div>
      </div>
    </div>
  );
}
