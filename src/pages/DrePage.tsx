import { useMemo, useState } from 'react';
import type { Transaction } from '../types';
import { buildDRE } from '../utils/dreMapping';
import type { DRELine, DREGroup } from '../utils/dreMapping';
import { fmtCurrency } from '../utils/analytics';
import { TransactionModal } from '../components/TransactionModal';
import { ChevronDown, ChevronRight, AlertTriangle, FileText, Columns } from 'lucide-react';

interface Props {
  saidas: Transaction[];
  entradas: Transaction[];
}

// ─── Row style config ─────────────────────────────────────────────────────────

const ROW_STYLES: Record<string, string> = {
  receita:   'bg-emerald-50 text-emerald-900',
  deducao:   'bg-rose-50 text-rose-800',
  despesa:   'bg-pink-50 text-slate-700',
  subtotal:  'bg-slate-700 text-white font-bold',
  resultado: 'bg-amber-800 text-white font-bold',
  fluxo:     'bg-slate-900 text-white font-bold',
};

// Explicit solid backgrounds for sticky cells (bg-inherit bleeds when scrolling)
const STICKY_BG: Record<string, string> = {
  receita:   'bg-emerald-50',
  deducao:   'bg-rose-50',
  despesa:   'bg-pink-50',
  subtotal:  'bg-slate-700',
  resultado: 'bg-amber-800',
  fluxo:     'bg-slate-900',
};

const DETAIL_ROW_STYLE: Record<string, string> = {
  receita:   'bg-emerald-50/60 text-emerald-800',
  deducao:   'bg-rose-50/60 text-rose-700',
  despesa:   'bg-pink-50/60 text-slate-600',
  subtotal:  'bg-slate-100 text-slate-600',
  resultado: 'bg-amber-50 text-amber-900',
  fluxo:     'bg-slate-100 text-slate-600',
};

const DETAIL_STICKY_BG: Record<string, string> = {
  receita:   'bg-emerald-50',
  deducao:   'bg-rose-50',
  despesa:   'bg-pink-50',
  subtotal:  'bg-slate-100',
  resultado: 'bg-amber-50',
  fluxo:     'bg-slate-100',
};

function subtotalValueColor(value: number): string {
  if (value > 0) return 'text-emerald-300';
  if (value < 0) return 'text-rose-300';
  return 'text-slate-400';
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

  const L = (n: number) => dre.lines.find((l) => l.linha === n);
  const receitaBruta = L(1)?.total ?? 0;
  const receitaBrutaByMonth = useMemo(() => L(1)?.months ?? {}, [dre]);
  const lucroBruto = L(5)?.total ?? 0;
  const ebita = L(9)?.total ?? 0;
  const resultado = L(17)?.total ?? 0;

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
        <p className="text-sm font-semibold text-slate-500">Carregue as planilhas para visualizar a DRE</p>
        <p className="text-xs text-slate-400 max-w-sm">
          Importe a base de saídas e entradas. O sistema correlacionará automaticamente as naturezas com as linhas da DRE.
        </p>
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
          <table className="text-xs border-collapse w-full" style={{ minWidth: `${480 + dre.monthKeys.length * (130 + (showPctMonth ? 60 : 0) + (showVariation ? 64 : 0))}px` }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {/* Sticky: Descrição */}
                <th className="text-left py-2.5 px-4 text-slate-500 font-semibold sticky left-0 z-20 bg-slate-50 border-r border-slate-200 w-64">
                  Descrição
                </th>
                {/* Total */}
                <th className="text-right py-2.5 px-4 text-slate-500 font-semibold min-w-[130px] border-r border-slate-100">
                  Total
                </th>
                {/* % Entrada (total acumulado) */}
                <th className="text-right py-2.5 px-3 text-indigo-500 font-semibold w-20 border-r border-slate-100">
                  % Total
                </th>
                {/* Month columns */}
                {dre.monthKeys.map((mk, i) => (
                  <>
                    <th key={mk} className="text-right py-2.5 px-4 text-amber-600 font-semibold min-w-[130px] capitalize border-l border-slate-100">
                      {dre.monthLabels[i]}
                    </th>
                    {showPctMonth && (
                      <th key={`pct-${mk}`} className="text-center py-2.5 px-2 text-indigo-400 font-semibold w-16 border-l border-slate-100">
                        % Mês
                      </th>
                    )}
                    {showVariation && i < dre.monthKeys.length - 1 && (
                      <th key={`var-${mk}`} className="text-center py-2.5 px-2 text-slate-400 font-semibold w-16 border-l border-slate-100">
                        Δ%
                      </th>
                    )}
                  </>
                ))}
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
                        {canExpand && (
                          isExpanded
                            ? <ChevronDown size={11} className="shrink-0 opacity-60" />
                            : <ChevronRight size={11} className="shrink-0 opacity-40" />
                        )}
                        <span className={`${isSubtotal ? 'font-bold' : ''} leading-snug`}>{line.descricao}</span>
                        {canClick && !canExpand && (
                          <span className="ml-1 text-[9px] opacity-40">[ver]</span>
                        )}
                      </div>
                    </td>
                    {/* Total */}
                    <td className={`py-2.5 px-4 text-right font-semibold border-r border-slate-100/30 ${isSubtotal ? subtotalValueColor(line.total) : ''}`}>
                      {line.total === 0 && !isSubtotal ? <span className="opacity-30">—</span> : fmtCurrency(line.total)}
                    </td>
                    {/* % da Entrada */}
                    <td className={`py-2.5 px-3 text-right border-r border-slate-100/30 ${isSubtotal ? 'text-indigo-200' : 'text-indigo-500'}`}>
                      {receitaBruta > 0 && line.total !== 0
                        ? <span className="text-[11px] font-semibold">{((line.total / receitaBruta) * 100).toFixed(1)}%</span>
                        : <span className="opacity-30">—</span>}
                    </td>
                    {/* Month + % Mês + variation */}
                    {dre.monthKeys.map((mk, i) => {
                      const v = line.months[mk] ?? 0;
                      const varV = momVariation(line.months, i);
                      const recMes = receitaBrutaByMonth[mk] ?? 0;
                      const monthHasTxs = line.transactions.some((t) => {
                        if (!t.data) return false;
                        return `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}` === mk;
                      });
                      return (
                        <>
                          <td
                            key={mk}
                            className={`py-2.5 px-4 text-right border-l border-slate-100/30 ${isSubtotal ? subtotalValueColor(v) : ''} ${monthHasTxs && v !== 0 ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}`}
                            onClick={monthHasTxs && v !== 0 ? (e) => { e.stopPropagation(); openMonthModal(line, mk, dre.monthLabels[i]); } : undefined}
                            title={monthHasTxs && v !== 0 ? `Ver lançamentos de ${dre.monthLabels[i]}` : undefined}
                          >
                            {v === 0 ? <span className="opacity-30">—</span> : fmtCurrency(v)}
                          </td>
                          {showPctMonth && (
                            <td key={`pct-${mk}`} className={`py-2.5 px-2 text-center border-l border-slate-100/20 w-16 ${isSubtotal ? 'text-indigo-200' : 'text-indigo-400'}`}>
                              {recMes > 0 && v !== 0
                                ? <span className="text-[10px] font-semibold">{((v / recMes) * 100).toFixed(1)}%</span>
                                : <span className="opacity-30 text-[10px]">—</span>}
                            </td>
                          )}
                          {showVariation && i < dre.monthKeys.length - 1 && (
                            <td key={`var-${mk}`} className="py-2.5 px-2 text-center border-l border-slate-100/20 w-16">
                              {varV !== null ? fmtVar(varV, line.sinal) : <span className="text-slate-300 text-[10px]">—</span>}
                            </td>
                          )}
                        </>
                      );
                    })}
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
                        <td className={`py-1.5 px-4 sticky left-0 z-10 ${detailStickyBg} border-r border-slate-200/40 pl-8`}>
                          <span className="opacity-70">·</span> {g.subcategoria}
                          {g.transactions.length > 0 && <span className="ml-1 text-[9px] opacity-40">[ver]</span>}
                        </td>
                        {/* Total */}
                        <td className="py-1.5 px-4 text-right border-r border-slate-100/20">{fmtVal(g.total)}</td>
                        {/* % da Entrada */}
                        <td className="py-1.5 px-3 text-right border-r border-slate-100/20 text-indigo-400">
                          {receitaBruta > 0 && g.total !== 0
                            ? <span className="text-[10px]">{((g.total / receitaBruta) * 100).toFixed(1)}%</span>
                            : <span className="opacity-30 text-[10px]">—</span>}
                        </td>
                        {/* Month + % Mês + variation (detail rows) */}
                        {dre.monthKeys.map((mk, i) => {
                          const v = g.months[mk] ?? 0;
                          const varV = momVariation(g.months, i);
                          const recMes = receitaBrutaByMonth[mk] ?? 0;
                          const groupMonthHasTxs = g.transactions.some((t) => {
                            if (!t.data) return false;
                            return `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}` === mk;
                          });
                          return (
                            <>
                              <td
                                key={mk}
                                className={`py-1.5 px-4 text-right border-l border-slate-100/20 ${groupMonthHasTxs && v !== 0 ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}`}
                                onClick={groupMonthHasTxs && v !== 0 ? (e) => { e.stopPropagation(); openGroupMonthModal(line, g, mk, dre.monthLabels[i]); } : undefined}
                                title={groupMonthHasTxs && v !== 0 ? `Ver lançamentos de ${dre.monthLabels[i]}` : undefined}
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
                              {showVariation && i < dre.monthKeys.length - 1 && (
                                <td key={`var-${mk}`} className="py-1.5 px-2 text-center border-l border-slate-100/10">
                                  {varV !== null ? fmtVar(varV, line.sinal) : <span className="text-slate-300 text-[10px]">—</span>}
                                </td>
                              )}
                            </>
                          );
                        })}
                      </tr>
                    ))
                  : [];

                return [mainRow, ...detailRows];
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-2.5 border-t border-slate-100 text-[10px] text-slate-400 bg-slate-50/50">
          Clique em linhas de dados para ver os lançamentos · Δ% = variação mês a mês = (Mês Atual − Mês Anterior) ÷ Mês Anterior × 100 · Fluxo de Caixa parte do saldo inicial de {fmtCurrency(dre.saldoInicial)} (jan/2026, soma das 3 contas)
        </div>
      </div>

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
