import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LabelList, ReferenceLine,
} from 'recharts';
import type { Transaction } from '../types';
import { buildDRE } from '../utils/dreMapping';
import type { DRELine, DREGroup } from '../utils/dreMapping';
import { fmtCurrency } from '../utils/analytics';
import { TransactionModal } from '../components/TransactionModal';
import { ChevronDown, ChevronRight, AlertTriangle, FileText, Columns, LineChart, BarChart2 } from 'lucide-react';

interface Props {
  saidas: Transaction[];
  entradas: Transaction[];
}

// ─── Row style config ─────────────────────────────────────────────────────────

const ROW_STYLES: Record<string, string> = {
  receita:   'bg-emerald-50 text-slate-700',
  deducao:   'bg-rose-50 text-slate-700',
  despesa:   'bg-rose-50 text-slate-700',
  subtotal:  'bg-sky-100 text-slate-800 font-bold',
  resultado: 'bg-slate-800 text-white font-bold',
  fluxo:     'bg-slate-900 text-white font-bold',
};

// Explicit solid backgrounds for sticky cells (bg-inherit bleeds when scrolling)
const STICKY_BG: Record<string, string> = {
  receita:   'bg-emerald-50',
  deducao:   'bg-rose-50',
  despesa:   'bg-rose-50',
  subtotal:  'bg-sky-100',
  resultado: 'bg-slate-800',
  fluxo:     'bg-slate-900',
};

const DETAIL_ROW_STYLE: Record<string, string> = {
  receita:   'bg-white text-slate-600',
  deducao:   'bg-white text-slate-600',
  despesa:   'bg-white text-slate-600',
  subtotal:  'bg-slate-50 text-slate-600',
  resultado: 'bg-slate-50 text-slate-600',
  fluxo:     'bg-slate-50 text-slate-600',
};

const DETAIL_STICKY_BG: Record<string, string> = {
  receita:   'bg-white',
  deducao:   'bg-white',
  despesa:   'bg-white',
  subtotal:  'bg-slate-50',
  resultado: 'bg-slate-50',
  fluxo:     'bg-slate-50',
};

function subtotalValueColor(value: number, rowStyle: string): string {
  const dark = rowStyle === 'resultado' || rowStyle === 'fluxo';
  // Subtotais azuis (Receita Líquida, Lucro Bruto, EBITA...) usam fonte preta padrão.
  // Só Resultado do Mês / Fluxo de Caixa (fundo escuro) mantêm verde/vermelho.
  if (!dark) return 'text-slate-800';
  if (value > 0) return 'text-emerald-300';
  if (value < 0) return 'text-rose-300';
  return 'text-slate-300';
}

// Variation color: for expense rows (-), falling = good; for income/subtotals, rising = good
function variationColor(v: number, sinal: '+' | '-' | null): string {
  const isGood = sinal === '-' ? v < 0 : v > 0;
  return isGood ? 'text-emerald-500' : 'text-rose-500';
}

function fmtVar(v: number, sinal: '+' | '-' | null): React.ReactNode {
  const color = variationColor(v, sinal);
  const sign = v > 0 ? '+' : '';
  return (
    <span className={`text-[10px] font-bold ${color}`}>
      {sign}{v.toFixed(1)}%
    </span>
  );
}

function fmtVal(v: number): string {
  return v === 0 ? '—' : fmtCurrency(v);
}

// ─── KPI bar ─────────────────────────────────────────────────────────────────

function KPI({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const color = value >= 0 ? 'text-emerald-600' : 'text-rose-600';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{fmtCurrency(value)}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Modal state ──────────────────────────────────────────────────────────────

interface ModalState {
  title: string;
  subtitle?: string;
  transactions: Transaction[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DrePage({ saidas, entradas }: Props) {
  const dre = useMemo(() => buildDRE(saidas, entradas), [saidas, entradas]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<ModalState | null>(null);
  const [showVariation, setShowVariation] = useState(false);
  const [showPctMonth, setShowPctMonth] = useState(false);

  const toggle = (linha: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(linha)) next.delete(linha);
      else next.add(linha);
      return next;
    });
  };

  const openLineModal = (line: DRELine) => {
    if (!line.transactions.length) return;
    setModal({ title: line.descricao, subtitle: `${line.transactions.length} lançamentos`, transactions: line.transactions });
  };

  const openGroupModal = (line: DRELine, group: DREGroup) => {
    if (!group.transactions.length) return;
    setModal({ title: group.subcategoria, subtitle: line.descricao, transactions: group.transactions });
  };

  const openMonthModal = (line: DRELine, mk: string, monthLabel: string) => {
    const txs = line.transactions.filter((t) => {
      if (!t.data) return false;
      const tmk = `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}`;
      return tmk === mk;
    });
    if (!txs.length) return;
    setModal({ title: line.descricao, subtitle: `${monthLabel} · ${txs.length} lançamentos`, transactions: txs });
  };

  const openGroupMonthModal = (line: DRELine, group: DREGroup, mk: string, monthLabel: string) => {
    const txs = group.transactions.filter((t) => {
      if (!t.data) return false;
      const tmk = `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}`;
      return tmk === mk;
    });
    if (!txs.length) return;
    setModal({ title: group.subcategoria, subtitle: `${line.descricao} · ${monthLabel} · ${txs.length} lançamentos`, transactions: txs });
  };

  const hasData = saidas.length > 0 || entradas.length > 0;

  // Coluna de abertura (Dez/2025): só o Fluxo de Caixa exibe o saldo inicial; o resto fica vazio.
  const OPENING = '2025-12';
  const colKeys = [OPENING, ...dre.monthKeys];
  const colLabel = (mk: string) =>
    mk === OPENING ? 'dezembro 2025' : dre.monthLabels[dre.monthKeys.indexOf(mk)];

  const L = (n: number) => dre.lines.find((l) => l.linha === n);
  const receitaBruta = L(1)?.total ?? 0;
  const receitaBrutaByMonth = useMemo(() => L(1)?.months ?? {}, [dre]);
  const lucroBruto = L(5)?.total ?? 0;
  const ebita = L(9)?.total ?? 0;
  const resultado = L(17)?.total ?? 0;

  // Série de Lucro Líquido (linha 12) mês a mês para o gráfico de evolução
  const lucroLiquidoSerie = useMemo(() => {
    const meses = L(12)?.months ?? {};
    return dre.monthKeys.map((mk) => {
      const [y, m] = mk.split('-');
      const short = `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(m) - 1]}/${y.slice(2)}`;
      return { mes: short, lucro: meses[mk] ?? 0 };
    });
  }, [dre]);

  // Composição de OPEX (linha 6) e SG&A (linha 8) por natureza, para os gráficos
  const opexTxs = L(6)?.transactions ?? [];
  const sgaTxs = L(8)?.transactions ?? [];
  const topNaturezas = (txs: Transaction[], n = 10) => {
    const m = new Map<string, number>();
    for (const t of txs) m.set(t.natureza, (m.get(t.natureza) ?? 0) + t.vRealizado);
    return Array.from(m.entries())
      .map(([natureza, total]) => ({ natureza, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, n);
  };
  const opexNat = topNaturezas(opexTxs);
  const sgaNat = topNaturezas(sgaTxs);
  const cfmt = (v: unknown) => {
    const n = Number(v);
    if (isNaN(n) || n === 0) return '';
    const abs = Math.abs(n); const s = n < 0 ? '−' : '';
    return abs >= 1_000_000 ? `${s}R$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1000 ? `${s}R$${(abs / 1000).toFixed(0)}k` : `${s}R$${abs.toFixed(0)}`;
  };
  const OPEX_COLORS = ['#f43f5e','#fb923c','#fbbf24','#a78bfa','#f472b6','#e879f9','#fb7185','#fdba74','#fcd34d','#c4b5fd'];
  const SGA_COLORS = ['#a78bfa','#c4b5fd','#8b5cf6','#7c3aed','#6d28d9','#5b21b6','#ddd6fe','#ede9fe','#7e22ce','#9333ea'];

  const pct = (v: number) =>
    receitaBruta > 0 ? ` (${((v / receitaBruta) * 100).toFixed(1)}% da entrada)` : '';

  // Compute MoM variation for a given month value vs previous
  const momVariation = (months: Record<string, number>, mkIdx: number): number | null => {
    if (mkIdx === 0) return null;
    const cur = months[dre.monthKeys[mkIdx]] ?? 0;
    const prev = months[dre.monthKeys[mkIdx - 1]] ?? 0;
    if (prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  };

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
        <FileText size={40} className="text-slate-200" />
        <p className="text-sm font-semibold text-slate-500">Processando dados…</p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Entrada Bruta" value={receitaBruta} />
        <KPI label="Lucro Bruto" value={lucroBruto} sub={pct(lucroBruto)} />
        <KPI label="EBITA" value={ebita} sub={pct(ebita)} />
        <KPI label="Resultado do Mês" value={resultado} sub={pct(resultado)} />
      </div>

      {/* DRE table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <FileText size={15} className="text-rose-500" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            DRE — Demonstração do Resultado do Exercício Regime Caixa
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {dre.monthKeys.length > 0 && (
              <button
                onClick={() => setShowPctMonth((v) => !v)}
                className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${showPctMonth ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
                title="Mostrar/ocultar coluna % do faturamento mensal"
              >
                <Columns size={11} />
                {showPctMonth ? 'Ocultar % faturamento' : 'Percentual sob faturamento'}
              </button>
            )}
            {dre.monthKeys.length > 1 && (
              <button
                onClick={() => setShowVariation((v) => !v)}
                className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${showVariation ? 'bg-slate-100 border-slate-300 text-slate-600' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
                title="Mostrar/ocultar colunas de variação mês vs mês"
              >
                <Columns size={11} />
                {showVariation ? 'Ocultar variação M/M' : 'Variação mês vs mês'}
              </button>
            )}
            {dre.monthKeys.length > 0 && (
              <span className="text-[10px] text-slate-400">
                {dre.monthKeys.length} {dre.monthKeys.length === 1 ? 'mês' : 'meses'} · clique para ver lançamentos
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full" style={{ minWidth: `${480 + colKeys.length * (130 + (showPctMonth ? 60 : 0) + (showVariation ? 64 : 0))}px` }}>
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                {/* Sticky: Descrição */}
                <th className="text-left py-2.5 px-4 text-slate-100 font-semibold sticky left-0 z-20 bg-slate-800 border-r border-slate-700 min-w-[248px] whitespace-nowrap">
                  Descrição
                </th>
                {/* Month columns */}
                {colKeys.map((mk, i) => (
                  <>
                    <th key={mk} className="text-right py-2.5 px-4 text-slate-100 font-semibold min-w-[130px] capitalize border-l border-slate-700">
                      {colLabel(mk)}
                    </th>
                    {showPctMonth && (
                      <th key={`pct-${mk}`} className="text-center py-2.5 px-2 text-slate-300 font-semibold w-16 border-l border-slate-700">
                        % Mês
                      </th>
                    )}
                    {showVariation && i < colKeys.length - 1 && (
                      <th key={`var-${mk}`} className="text-center py-2.5 px-2 text-slate-300 font-semibold w-16 border-l border-slate-700">
                        Δ%
                      </th>
                    )}
                  </>
                ))}
                {/* Total + % Total — últimas colunas */}
                <th className="text-right py-2.5 px-4 text-slate-100 font-semibold min-w-[130px] border-l border-slate-700">
                  Total
                </th>
                <th className="text-right py-2.5 px-3 text-slate-300 font-semibold w-20 border-l border-slate-700">
                  % Total
                </th>
              </tr>
            </thead>
            <tbody>
              {dre.lines.flatMap((line: DRELine) => {
                const isSubtotal = line.rowStyle === 'subtotal' || line.rowStyle === 'resultado' || line.rowStyle === 'fluxo';
                const isExpanded = expanded.has(line.linha);
                const rowCls = ROW_STYLES[line.rowStyle] ?? '';
                const stickyBg = STICKY_BG[line.rowStyle] ?? 'bg-white';
                const detailRowCls = DETAIL_ROW_STYLE[line.rowStyle] ?? '';
                const detailStickyBg = DETAIL_STICKY_BG[line.rowStyle] ?? 'bg-white';
                const canClick = line.transactions.length > 0;
                const canExpand = line.expandable && line.groups.length > 0;
                const isDark = line.rowStyle === 'resultado' || line.rowStyle === 'fluxo';

                const mainRow = (
                  <tr
                    key={`line-${line.linha}`}
                    className={`border-b border-slate-100/50 ${rowCls} ${canClick ? 'cursor-pointer hover:brightness-95 transition-all' : ''}`}
                    onClick={() => {
                      if (canExpand) toggle(line.linha);
                      else if (canClick) openLineModal(line);
                    }}
                  >
                    {/* Descrição — sticky left-0 */}
                    <td className={`py-2.5 px-4 sticky left-0 z-10 ${stickyBg} border-r border-slate-200/50`}>
                      <div className="flex items-center gap-1.5">
                        {/* Slot fixo p/ a seta — mantém o texto alinhado mesmo sem seta */}
                        <span className="w-3 shrink-0 flex items-center justify-center">
                          {canExpand && (
                            isExpanded
                              ? <ChevronDown size={11} className="opacity-60" />
                              : <ChevronRight size={11} className="opacity-40" />
                          )}
                        </span>
                        <span className={`${isSubtotal ? 'font-bold' : ''} leading-snug whitespace-nowrap`}>{line.descricao}</span>
                        {canClick && !canExpand && (
                          <span className="ml-1 text-[9px] opacity-40">[ver]</span>
                        )}
                      </div>
                    </td>
                    {/* Month + % Mês + variation */}
                    {colKeys.map((mk, i) => {
                      const isDez = mk === OPENING;
                      // Dez/2025: só o Fluxo de Caixa mostra o saldo inicial; demais linhas vazias
                      const v = isDez ? (line.rowStyle === 'fluxo' ? dre.saldoInicial : 0) : (line.months[mk] ?? 0);
                      const realIdx = dre.monthKeys.indexOf(mk);
                      const varV = isDez ? null : momVariation(line.months, realIdx);
                      const recMes = isDez ? 0 : (receitaBrutaByMonth[mk] ?? 0);
                      const monthHasTxs = !isDez && line.transactions.some((t) => {
                        if (!t.data) return false;
                        return `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}` === mk;
                      });
                      return (
                        <>
                          <td
                            key={mk}
                            className={`py-2.5 px-4 text-right border-l border-slate-100/30 ${isSubtotal ? subtotalValueColor(v, line.rowStyle) : ''} ${monthHasTxs && v !== 0 ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}`}
                            onClick={monthHasTxs && v !== 0 ? (e) => { e.stopPropagation(); openMonthModal(line, mk, colLabel(mk)); } : undefined}
                            title={monthHasTxs && v !== 0 ? `Ver lançamentos de ${colLabel(mk)}` : undefined}
                          >
                            {v === 0 ? <span className="opacity-30">—</span> : fmtCurrency(v)}
                          </td>
                          {showPctMonth && (
                            <td key={`pct-${mk}`} className={`py-2.5 px-2 text-center border-l border-slate-100/20 w-16 ${isDark ? 'text-indigo-200' : 'text-indigo-400'}`}>
                              {recMes > 0 && v !== 0
                                ? <span className="text-[10px] font-semibold">{((v / recMes) * 100).toFixed(1)}%</span>
                                : <span className="opacity-30 text-[10px]">—</span>}
                            </td>
                          )}
                          {showVariation && i < colKeys.length - 1 && (
                            <td key={`var-${mk}`} className="py-2.5 px-2 text-center border-l border-slate-100/20 w-16">
                              {varV !== null ? fmtVar(varV, line.sinal) : <span className="text-slate-300 text-[10px]">—</span>}
                            </td>
                          )}
                        </>
                      );
                    })}
                    {/* Total + % Total — últimas colunas */}
                    <td className={`py-2.5 px-4 text-right font-semibold border-l border-slate-200/60 ${isSubtotal ? subtotalValueColor(line.total, line.rowStyle) : ''}`}>
                      {line.total === 0 && !isSubtotal ? <span className="opacity-30">—</span> : fmtCurrency(line.total)}
                    </td>
                    <td className={`py-2.5 px-3 text-right border-l border-slate-100/30 ${isDark ? 'text-indigo-200' : 'text-indigo-500'}`}>
                      {receitaBruta > 0 && line.total !== 0
                        ? <span className="text-[11px] font-semibold">{((line.total / receitaBruta) * 100).toFixed(1)}%</span>
                        : <span className="opacity-30">—</span>}
                    </td>
                  </tr>
                );

                const detailRows = isExpanded
                  ? line.groups.map((g: DREGroup) => (
                      <tr
                        key={`group-${line.linha}-${g.subcategoria}`}
                        className={`border-b border-slate-100/20 ${detailRowCls} ${g.transactions.length > 0 ? 'cursor-pointer hover:brightness-95' : ''}`}
                        onClick={() => openGroupModal(line, g)}
                      >
                        {/* Subcategoria — sticky left-0 */}
                        <td className={`py-1.5 px-4 sticky left-0 z-10 ${detailStickyBg} border-r border-slate-200/40 pl-8 whitespace-nowrap`}>
                          <span className="opacity-70">·</span> {g.subcategoria}
                          {g.transactions.length > 0 && <span className="ml-1 text-[9px] opacity-40">[ver]</span>}
                        </td>
                        {/* Month + % Mês + variation (detail rows) */}
                        {colKeys.map((mk, i) => {
                          const isDez = mk === OPENING;
                          const v = isDez ? 0 : (g.months[mk] ?? 0);
                          const realIdx = dre.monthKeys.indexOf(mk);
                          const varV = isDez ? null : momVariation(g.months, realIdx);
                          const recMes = isDez ? 0 : (receitaBrutaByMonth[mk] ?? 0);
                          const groupMonthHasTxs = !isDez && g.transactions.some((t) => {
                            if (!t.data) return false;
                            return `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}` === mk;
                          });
                          return (
                            <>
                              <td
                                key={mk}
                                className={`py-1.5 px-4 text-right border-l border-slate-100/20 ${groupMonthHasTxs && v !== 0 ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}`}
                                onClick={groupMonthHasTxs && v !== 0 ? (e) => { e.stopPropagation(); openGroupMonthModal(line, g, mk, colLabel(mk)); } : undefined}
                                title={groupMonthHasTxs && v !== 0 ? `Ver lançamentos de ${colLabel(mk)}` : undefined}
                              >
                                {fmtVal(v)}
                              </td>
                              {showPctMonth && (
                                <td key={`pct-${mk}`} className="py-1.5 px-2 text-center border-l border-slate-100/10 text-indigo-400">
                                  {recMes > 0 && v !== 0
                                    ? <span className="text-[10px]">{((v / recMes) * 100).toFixed(1)}%</span>
                                    : <span className="opacity-30 text-[10px]">—</span>}
                                </td>
                              )}
                              {showVariation && i < colKeys.length - 1 && (
                                <td key={`var-${mk}`} className="py-1.5 px-2 text-center border-l border-slate-100/10">
                                  {varV !== null ? fmtVar(varV, line.sinal) : <span className="text-slate-300 text-[10px]">—</span>}
                                </td>
                              )}
                            </>
                          );
                        })}
                        {/* Total + % Total — últimas colunas */}
                        <td className="py-1.5 px-4 text-right border-l border-slate-200/60">{fmtVal(g.total)}</td>
                        <td className="py-1.5 px-3 text-right border-l border-slate-100/20 text-indigo-400">
                          {receitaBruta > 0 && g.total !== 0
                            ? <span className="text-[10px]">{((g.total / receitaBruta) * 100).toFixed(1)}%</span>
                            : <span className="opacity-30 text-[10px]">—</span>}
                        </td>
                      </tr>
                    ))
                  : [];

                return [mainRow, ...detailRows];
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-2.5 border-t border-slate-100 text-[10px] text-slate-400 bg-slate-50/50">
          Clique em linhas de dados para ver os lançamentos · Δ% = variação mês a mês = (Mês Atual − Mês Anterior) ÷ Mês Anterior × 100 · Coluna dez/2025 = saldo inicial de caixa ({fmtCurrency(dre.saldoInicial)}, soma das 3 contas); o Fluxo de Caixa acumula os meses a partir dela
        </div>
      </div>

      {/* Evolução do Lucro Líquido */}
      {lucroLiquidoSerie.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <LineChart size={16} className="text-emerald-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Evolução do Lucro Líquido</h2>
            <span className="text-[10px] text-slate-400 ml-auto">Linha 12 do DRE · mês a mês</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={lucroLiquidoSerie} margin={{ top: 24, right: 16, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tickFormatter={(v: number) => {
                  const abs = Math.abs(v);
                  const s = v < 0 ? '−' : '';
                  return abs >= 1000 ? `${s}R$${(abs / 1000).toFixed(0)}k` : `${s}R$${abs.toFixed(0)}`;
                }}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                width={64}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
                      <p className="font-bold text-slate-700 mb-1">{label}</p>
                      <p className={`font-bold ${(payload[0].value as number) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Lucro Líquido: {fmtCurrency(payload[0].value as number)}
                      </p>
                    </div>
                  ) : null
                }
              />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
              <Bar dataKey="lucro" name="Lucro Líquido" radius={[5, 5, 0, 0]} maxBarSize={64}>
                {lucroLiquidoSerie.map((d, idx) => (
                  <Cell key={idx} fill={d.lucro >= 0 ? '#10b981' : '#f43f5e'} />
                ))}
                <LabelList
                  dataKey="lucro"
                  position="top"
                  formatter={(v: unknown) => {
                    const n = Number(v);
                    const abs = Math.abs(n);
                    const s = n < 0 ? '−' : '';
                    return abs >= 1000 ? `${s}R$${(abs / 1000).toFixed(0)}k` : `${s}R$${abs.toFixed(0)}`;
                  }}
                  style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Composição de Despesas — OPEX e SG&A (movidos da Visão Geral) */}
      {(opexNat.length > 0 || sgaNat.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {opexNat.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={15} className="text-rose-500" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Despesas Operacionais (OPEX)</h2>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(240, opexNat.length * 30)}>
                <BarChart data={opexNat} layout="vertical" margin={{ top: 2, right: 90, left: 8, bottom: 2 }}
                  onClick={() => opexTxs.length && setModal({ title: 'Despesas Operacionais (OPEX)', subtitle: `${opexTxs.length} lançamentos`, transactions: opexTxs })}
                  style={{ cursor: 'pointer' }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={cfmt} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="natureza" width={150} tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v: unknown) => { const s = String(v); return s.length > 22 ? s.slice(0, 22) + '…' : s; }} />
                  <Tooltip content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[200px]">
                        <p className="font-semibold text-slate-700">{label}</p>
                        <p className="font-bold text-rose-600 mt-1">{fmtCurrency(payload[0].value as number)}</p>
                        <p className="text-[10px] text-slate-400 mt-1 italic">Clique para abrir a base completa de OPEX</p>
                      </div>
                    ) : null
                  } />
                  <Bar dataKey="total" radius={[0, 5, 5, 0]}>
                    {opexNat.map((_, idx) => <Cell key={idx} fill={OPEX_COLORS[idx % OPEX_COLORS.length]} />)}
                    <LabelList dataKey="total" position="right" formatter={(v: unknown) => cfmt(v)} style={{ fontSize: 10, fontWeight: 600, fill: '#475569' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {sgaNat.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={15} className="text-violet-500" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Despesas de Vendas, Gerais e Administrativas (SG&amp;A)</h2>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(240, sgaNat.length * 30)}>
                <BarChart data={sgaNat} layout="vertical" margin={{ top: 2, right: 90, left: 8, bottom: 2 }}
                  onClick={() => sgaTxs.length && setModal({ title: 'Despesas de Vendas, Gerais e Administrativas (SG&A)', subtitle: `${sgaTxs.length} lançamentos`, transactions: sgaTxs })}
                  style={{ cursor: 'pointer' }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={cfmt} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="natureza" width={150} tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v: unknown) => { const s = String(v); return s.length > 22 ? s.slice(0, 22) + '…' : s; }} />
                  <Tooltip content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[200px]">
                        <p className="font-semibold text-slate-700">{label}</p>
                        <p className="font-bold text-violet-600 mt-1">{fmtCurrency(payload[0].value as number)}</p>
                        <p className="text-[10px] text-slate-400 mt-1 italic">Clique para abrir a base completa de SG&amp;A</p>
                      </div>
                    ) : null
                  } />
                  <Bar dataKey="total" radius={[0, 5, 5, 0]}>
                    {sgaNat.map((_, idx) => <Cell key={idx} fill={SGA_COLORS[idx % SGA_COLORS.length]} />)}
                    <LabelList dataKey="total" position="right" formatter={(v: unknown) => cfmt(v)} style={{ fontSize: 10, fontWeight: 600, fill: '#475569' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Unmapped naturezas */}
      {dre.unmapped.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-200">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <p className="text-xs font-bold text-amber-700">
              {dre.unmapped.length} natureza{dre.unmapped.length > 1 ? 's' : ''} sem mapeamento DRE
            </p>
            <p className="text-[10px] text-amber-500 ml-auto">
              Total: {fmtCurrency(dre.unmapped.reduce((a, b) => a + b.total, 0))} · não incluído nos cálculos acima
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-amber-200">
                  <th className="text-left py-2 px-4 text-amber-600 font-semibold">Natureza</th>
                  <th className="text-right py-2 px-4 text-amber-600 font-semibold">Total</th>
                  {dre.monthLabels.map((label, i) => (
                    <th key={dre.monthKeys[i]} className="text-right py-2 px-4 text-amber-600 font-semibold capitalize min-w-[120px]">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dre.unmapped.map((u) => (
                  <tr key={u.natureza} className="border-b border-amber-100 hover:bg-amber-100/50">
                    <td className="py-2 px-4 text-amber-800 font-medium">{u.natureza}</td>
                    <td className="py-2 px-4 text-right text-amber-700">{fmtCurrency(u.total)}</td>
                    {dre.monthKeys.map((mk) => (
                      <td key={mk} className="py-2 px-4 text-right text-amber-600">{fmtVal(u.months[mk] ?? 0)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction modal */}
      {modal && (
        <TransactionModal
          title={modal.title}
          subtitle={modal.subtitle}
          transactions={modal.transactions}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
