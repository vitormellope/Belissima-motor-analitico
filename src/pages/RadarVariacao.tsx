import { useMemo, useState } from 'react';
import type { Transaction } from '../types';
import { buildNaturezaMatrix, fmtCurrency, sumRealizado } from '../utils/analytics';
import { TransactionModal } from '../components/TransactionModal';
import { Activity, Info, TrendingDown, TrendingUp, Search } from 'lucide-react';
import { filterByPeriod } from '../utils/analytics';

interface Props {
  saidas: Transaction[];
}

// ─── Color scale ──────────────────────────────────────────────────────────────
// For expenses: ↑ = bad (red), ↓ = good (green)
function variationStyle(v: number | null, total: number): {
  bg: string; text: string; ring?: string;
} {
  if (v === null || total === 0)
    return { bg: 'bg-slate-50', text: 'text-slate-300' };
  if (v >  80) return { bg: 'bg-red-700',     text: 'text-white' };
  if (v >  40) return { bg: 'bg-red-500',     text: 'text-white' };
  if (v >  15) return { bg: 'bg-red-300',     text: 'text-red-900' };
  if (v >   5) return { bg: 'bg-red-100',     text: 'text-red-700' };
  if (v >  -5) return { bg: 'bg-slate-100',   text: 'text-slate-500' };
  if (v > -15) return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
  if (v > -40) return { bg: 'bg-emerald-300', text: 'text-emerald-900' };
  if (v > -80) return { bg: 'bg-emerald-500', text: 'text-white' };
  return { bg: 'bg-emerald-700', text: 'text-white' };
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex items-center">
      <button
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

interface ModalState {
  title: string;
  subtitle: string;
  transactions: Transaction[];
}

export function RadarVariacao({ saidas }: Props) {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [highlightThreshold, setHighlightThreshold] = useState(15);

  const { rows, monthKeys, monthLabels } = useMemo(
    () => buildNaturezaMatrix(saidas),
    [saidas]
  );

  const totalGeral = useMemo(() => sumRealizado(saidas), [saidas]);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) =>
        r.natureza.toLowerCase().includes(search.toLowerCase())
      ),
    [rows, search]
  );

  // Count cells with high variation above threshold
  const alertCount = useMemo(() => {
    let count = 0;
    for (const row of rows) {
      for (const cell of row.cells) {
        if (cell.variation !== null && Math.abs(cell.variation) >= highlightThreshold && cell.total > 0)
          count++;
      }
    }
    return count;
  }, [rows, highlightThreshold]);

  function openCellModal(natureza: string, monthKey: string, monthLabel: string) {
    const [y, m] = monthKey.split('-');
    const start = new Date(+y, +m - 1, 1);
    const end = new Date(+y, +m, 0, 23, 59, 59);
    const txs = filterByPeriod(
      saidas.filter((t) => t.natureza === natureza),
      start,
      end
    );
    setModal({
      title: natureza,
      subtitle: `Lançamentos de ${monthLabel}`,
      transactions: txs,
    });
  }

  function openRowModal(natureza: string) {
    const txs = saidas.filter((t) => t.natureza === natureza);
    setModal({
      title: natureza,
      subtitle: `Todos os lançamentos — ${txs.length} registros`,
      transactions: txs,
    });
  }

  if (saidas.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
        <Activity size={32} className="text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Faça o upload da planilha de saídas para visualizar o Radar de Variação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={18} className="text-rose-500" />
              <h1 className="text-base font-bold text-slate-800">Radar de Variação</h1>
              <InfoTooltip text="Matriz que mostra a evolução mês a mês de cada categoria de despesa (Natureza). A variação é calculada como: (Mês Atual − Mês Anterior) ÷ Mês Anterior × 100. Vermelho = despesa cresceu (risco); Verde = despesa reduziu (economia). Células em branco = sem lançamento naquele mês." />
            </div>
            <p className="text-xs text-slate-500">
              Variação mês a mês de <strong>{rows.length} categorias</strong> de despesa ·{' '}
              <span className="text-rose-600 font-semibold">{alertCount} alertas</span> com variação &gt;{highlightThreshold}%
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Alerta &gt;</span>
              <input
                type="number"
                value={highlightThreshold}
                onChange={(e) => setHighlightThreshold(Math.max(1, +e.target.value))}
                className="w-14 text-center border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-rose-400"
              />
              <span>%</span>
              <InfoTooltip text="Define o limiar de variação percentual para considerar uma célula como 'alerta'. Células com variação absoluta acima deste valor ficam destacadas com cor mais intensa." />
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar natureza…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-rose-400 w-44"
              />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-100">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mr-1">Variação vs mês anterior:</span>
          {[
            { bg: 'bg-emerald-700', text: 'text-white', label: '< −40% (grande economia)' },
            { bg: 'bg-emerald-300', text: 'text-emerald-900', label: '−15 a −40%' },
            { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '−5 a −15%' },
            { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Estável (±5%)' },
            { bg: 'bg-red-100', text: 'text-red-700', label: '+5 a +15%' },
            { bg: 'bg-red-300', text: 'text-red-900', label: '+15 a +40%' },
            { bg: 'bg-red-700', text: 'text-white', label: '> +40% (alerta)' },
          ].map((item) => (
            <span key={item.label} className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-md ${item.bg} ${item.text}`}>
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total de Despesas',
            value: fmtCurrency(totalGeral),
            sub: `em ${monthKeys.length} meses`,
            color: 'text-rose-600',
            tooltip: 'Soma de todos os V. Realizado de saídas no período completo disponível na planilha.',
          },
          {
            label: 'Média Mensal',
            value: fmtCurrency(totalGeral / Math.max(monthKeys.length, 1)),
            sub: 'por mês',
            color: 'text-slate-700',
            tooltip: `Calculado como: Total de Despesas (${fmtCurrency(totalGeral)}) ÷ ${monthKeys.length} meses.`,
          },
          {
            label: 'Categorias',
            value: String(rows.length),
            sub: 'naturezas distintas',
            color: 'text-violet-600',
            tooltip: 'Número de categorias (Natureza) únicas encontradas na planilha de saídas.',
          },
          {
            label: 'Alertas de Alta',
            value: String(alertCount),
            sub: `variação > ${highlightThreshold}%`,
            color: 'text-red-600',
            tooltip: `Células da matriz onde a variação mês a mês é maior que ${highlightThreshold}% em valor absoluto. Indica categorias que merecem atenção imediata.`,
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-1 mb-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{card.label}</p>
              <InfoTooltip text={card.tooltip} />
            </div>
            <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Matrix */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left py-3 px-4 text-slate-600 font-bold sticky left-0 bg-slate-50 z-20 min-w-[200px] border-b border-r border-slate-200">
                  <span className="flex items-center gap-1">
                    Natureza / Despesa
                    <InfoTooltip text="Clique no nome da natureza para ver todos os lançamentos desta categoria em todos os meses. Clique em uma célula específica para ver apenas os lançamentos daquele mês." />
                  </span>
                </th>
                <th className="text-right py-3 px-3 text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap">
                  <span className="flex items-center justify-end gap-1">
                    Total
                    <InfoTooltip text="Soma total de todos os meses disponíveis para esta natureza." />
                  </span>
                </th>
                <th className="text-right py-3 px-3 text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap">
                  <span className="flex items-center justify-end gap-1">
                    % Total
                    <InfoTooltip text="Participação desta natureza no total geral de despesas. Calculado como: Total da Natureza ÷ Total de Todas as Despesas × 100." />
                  </span>
                </th>
                {monthLabels.map((ml, i) => (
                  <th key={monthKeys[i]} className="text-center py-3 px-3 text-slate-600 font-bold border-b border-l border-slate-200 whitespace-nowrap min-w-[90px]">
                    {ml}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rowIdx) => {
                const pctTotal = totalGeral > 0 ? (row.totalGeral / totalGeral) * 100 : 0;
                return (
                  <tr
                    key={row.natureza}
                    className={`group ${rowIdx % 2 === 0 ? '' : 'bg-slate-50/30'} hover:bg-slate-50`}
                  >
                    {/* Natureza name — clickable */}
                    <td className="py-2 px-4 sticky left-0 z-10 border-r border-slate-100 border-b border-slate-50"
                      style={{ background: rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}
                    >
                      <button
                        onClick={() => openRowModal(row.natureza)}
                        className="text-left font-semibold text-slate-700 hover:text-rose-600 hover:underline transition-colors w-full truncate block"
                        title={`Ver todos os lançamentos de "${row.natureza}"`}
                      >
                        {row.natureza}
                      </button>
                    </td>

                    {/* Total */}
                    <td className="py-2 px-3 text-right font-bold text-rose-600 border-b border-slate-50 whitespace-nowrap">
                      {fmtCurrency(row.totalGeral)}
                    </td>

                    {/* % Total */}
                    <td className="py-2 px-3 text-right border-b border-slate-50">
                      <span className="text-slate-600 font-semibold">{pctTotal.toFixed(1)}%</span>
                      <span className="text-slate-400 text-[10px] ml-1">do total</span>
                    </td>

                    {/* Month cells */}
                    {row.cells.map((cell, ci) => {
                      const style = variationStyle(cell.variation, cell.total);
                      const isAlert = cell.variation !== null && Math.abs(cell.variation) >= highlightThreshold && cell.total > 0;

                      return (
                        <td
                          key={cell.monthKey}
                          className={`py-0 px-0 border-b border-l border-slate-100 text-center ${ci === row.cells.length - 1 ? '' : ''}`}
                        >
                          {cell.total > 0 ? (
                            <button
                              onClick={() => openCellModal(row.natureza, cell.monthKey, cell.monthLabel)}
                              className={`w-full h-full py-2 px-2 ${style.bg} ${style.text} hover:opacity-80 transition-opacity ${isAlert ? 'ring-1 ring-inset ring-current' : ''} block`}
                              title={`${row.natureza} · ${cell.monthLabel}\nTotal: ${fmtCurrency(cell.total)}\n${cell.variation !== null ? `Variação vs ${monthLabels[row.cells.indexOf(cell) - 1] ?? 'anterior'}: ${cell.variation >= 0 ? '+' : ''}${cell.variation.toFixed(1)}%\nFórmula: (${fmtCurrency(cell.total)} − ${fmtCurrency(row.cells[row.cells.indexOf(cell) - 1]?.total ?? 0)}) ÷ ${fmtCurrency(row.cells[row.cells.indexOf(cell) - 1]?.total ?? 0)} × 100` : 'Primeiro mês — sem mês anterior para comparar'}\nClique para ver os lançamentos.`}
                            >
                              <span className="block text-[10px] font-bold leading-tight">
                                {cell.variation !== null ? (
                                  <>
                                    {cell.variation >= 0 ? '+' : ''}{cell.variation.toFixed(0)}%
                                  </>
                                ) : (
                                  <span className="opacity-50">—</span>
                                )}
                              </span>
                              <span className="block text-[9px] opacity-70 mt-0.5 font-medium">
                                {fmtCurrency(cell.total).replace('R$', '')}
                              </span>
                            </button>
                          ) : (
                            <div className="py-2 px-2 text-slate-200 text-[10px]">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Total row */}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <td className="py-2.5 px-4 sticky left-0 z-10 bg-slate-100 border-r border-slate-200 text-slate-800">
                  TOTAL MENSAL
                </td>
                <td className="py-2.5 px-3 text-right text-rose-700 border-l border-slate-200">
                  {fmtCurrency(totalGeral)}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-600 border-l border-slate-200">100%</td>
                {monthKeys.map((mk, i) => {
                  const [y, m] = mk.split('-');
                  const start = new Date(+y, +m - 1, 1);
                  const end = new Date(+y, +m, 0, 23, 59, 59);
                  const monthTotal = sumRealizado(filterByPeriod(saidas, start, end));
                  const prevMk = monthKeys[i - 1];
                  let prevTotal = 0;
                  if (prevMk) {
                    const [py2, pm2] = prevMk.split('-');
                    const ps = new Date(+py2, +pm2 - 1, 1);
                    const pe = new Date(+py2, +pm2, 0, 23, 59, 59);
                    prevTotal = sumRealizado(filterByPeriod(saidas, ps, pe));
                  }
                  const variation = i > 0 && prevTotal > 0 ? ((monthTotal - prevTotal) / prevTotal) * 100 : null;
                  return (
                    <td key={mk} className="py-2.5 px-2 text-center border-l border-slate-200">
                      <span className="block text-[11px] font-bold text-rose-700">{fmtCurrency(monthTotal)}</span>
                      {variation !== null && (
                        <span className={`text-[9px] font-semibold ${variation > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {variation >= 0 ? '+' : ''}{variation.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {filteredRows.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            Nenhuma natureza encontrada para "{search}".
          </div>
        )}

        <div className="px-4 py-3 border-t border-slate-100 text-[10px] text-slate-400 bg-slate-50/50 rounded-b-2xl">
          Clique em qualquer célula colorida para ver os lançamentos individuais · Clique no nome da natureza para ver o histórico completo
          · Variação = (Mês Atual − Mês Anterior) ÷ Mês Anterior × 100
        </div>
      </div>

      {/* Top 5 crescimento e redução */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Maiores altas (últimos 2 meses) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-red-500" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Maiores Altas Recentes</h3>
            <InfoTooltip text="Top 5 categorias com maior variação positiva (aumento de despesa) no mês mais recente com dados. Ordenado por variação percentual decrescente." />
          </div>
          <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
            {rows
              .map((r) => {
                const lastCell = [...r.cells].reverse().find((c) => c.total > 0 && c.variation !== null);
                return { natureza: r.natureza, variation: lastCell?.variation ?? null, total: lastCell?.total ?? 0, month: lastCell?.monthLabel };
              })
              .filter((x) => x.variation !== null && x.variation > 0)
              .sort((a, b) => (b.variation ?? 0) - (a.variation ?? 0))
              .map((item, idx) => (
                <div key={item.natureza} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-slate-400 font-bold shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{item.natureza}</p>
                    <p className="text-[10px] text-slate-400">{item.month} · {fmtCurrency(item.total)}</p>
                  </div>
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full shrink-0">
                    +{item.variation!.toFixed(0)}%
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Maiores quedas */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={15} className="text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Maiores Reduções Recentes</h3>
            <InfoTooltip text="Top 5 categorias com maior variação negativa (redução de despesa) no mês mais recente com dados. Representa áreas onde houve economia." />
          </div>
          <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
            {rows
              .map((r) => {
                const lastCell = [...r.cells].reverse().find((c) => c.total > 0 && c.variation !== null);
                return { natureza: r.natureza, variation: lastCell?.variation ?? null, total: lastCell?.total ?? 0, month: lastCell?.monthLabel };
              })
              .filter((x) => x.variation !== null && x.variation < 0)
              .sort((a, b) => (a.variation ?? 0) - (b.variation ?? 0))
              .map((item, idx) => (
                <div key={item.natureza} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-slate-400 font-bold shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{item.natureza}</p>
                    <p className="text-[10px] text-slate-400">{item.month} · {fmtCurrency(item.total)}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                    {item.variation!.toFixed(0)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Modal */}
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
