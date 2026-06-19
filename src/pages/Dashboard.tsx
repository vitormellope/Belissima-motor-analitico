import { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LabelList, ReferenceLine, Cell,
} from 'recharts';
import type { Transaction, PeriodType, PeriodMode } from '../types';
import {
  filterByPeriod, getPeriodBounds, getPreviousPeriodBounds,
  sumRealizado, getNaturezaComparativo, getContaTotals,
  getTopFornecedores, buildTimeSeries, calcVariation, fmtCurrency,
  chartGranularity, autoGranularity, getDayOfWeekTotals,
} from '../utils/analytics';
import { DRE_MAPEAMENTO } from '../utils/dreMapping';
import { KPICard } from '../components/KPICard';
import { PeriodFilter } from '../components/PeriodFilter';
import { TransactionModal } from '../components/TransactionModal';
import {
  TrendingDown, TrendingUp, Wallet, BarChart2,
  ArrowLeftRight, Store, CreditCard, CalendarDays, Info,
  GitCompare, ShoppingCart,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  saidas: Transaction[];
  entradas: Transaction[];
}

// ─── Palettes ─────────────────────────────────────────────────────────────────
const DESPESA_COLORS = [
  '#f43f5e','#fb923c','#fbbf24','#a78bfa','#f472b6',
  '#e879f9','#fb7185','#fdba74','#fcd34d','#c4b5fd',
  '#f9a8d4','#86efac','#67e8f9','#93c5fd','#d8b4fe',
];

const cfmt = (v: unknown) => {
  const n = Number(v);
  if (isNaN(n) || n === 0) return '';
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  return abs >= 1_000_000
    ? `${sign}R$${(abs / 1_000_000).toFixed(1)}M`
    : abs >= 1000
    ? `${sign}R$${(abs / 1000).toFixed(0)}k`
    : `${sign}R$${abs.toFixed(0)}`;
};

const rotuloFmt = (v: unknown) => {
  const n = Number(v);
  return n > 0 ? cfmt(n) : '';
};

// ─── Sub-components ───────────────────────────────────────────────────────────
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

function SectionTitle({
  icon, title, tooltip, badge,
}: {
  icon: React.ReactNode;
  title: string;
  tooltip?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-rose-500">{icon}</span>
      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
      {badge}
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
  );
}

function TypeBadge({ type }: { type: 'despesa' | 'receita' }) {
  return type === 'despesa' ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />DESPESA
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />RECEITA
    </span>
  );
}

function formatRangeLabel(start: Date, end: Date) {
  return `${format(start, "d 'de' MMM", { locale: ptBR })} – ${format(end, "d 'de' MMM", { locale: ptBR })}`;
}

// ─── Comparison Panel ─────────────────────────────────────────────────────────
function ComparisonPanel({
  label1, label2,
  saidasCur, saidasPrev, entradasCur, entradasPrev,
  gran, start1, end1, start2, end2,
}: {
  label1: string; label2: string;
  saidasCur: Transaction[]; saidasPrev: Transaction[];
  entradasCur: Transaction[]; entradasPrev: Transaction[];
  gran: PeriodType;
  start1: Date; end1: Date;
  start2: Date; end2: Date;
}) {
  const t1S = sumRealizado(saidasCur);
  const t2S = sumRealizado(saidasPrev);
  const t1E = sumRealizado(entradasCur);
  const t2E = sumRealizado(entradasPrev);
  const varS = calcVariation(t1S, t2S);
  const varE = calcVariation(t1E, t2E);

  const s1 = buildTimeSeries(saidasCur, entradasCur, gran, start1, end1);
  const s2 = buildTimeSeries(saidasPrev, entradasPrev, gran, start2, end2);
  const len = Math.max(s1.length, s2.length);
  const merged = Array.from({ length: len }, (_, i) => ({
    idx: String(i + 1),
    p1S: s1[i]?.saidas ?? 0, p1E: s1[i]?.entradas ?? 0,
    p2S: s2[i]?.saidas ?? 0, p2E: s2[i]?.entradas ?? 0,
  }));

  return (
    <div className="bg-white rounded-2xl border-2 border-violet-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare size={16} className="text-violet-500" />
        <h2 className="text-sm font-bold text-violet-700 uppercase tracking-wide">Comparativo de Períodos</h2>
        <InfoTooltip text="Confronto direto entre os dois períodos selecionados. Variação = (P1 − P2) ÷ P2 × 100. Para despesas: ▲ = aumentou (atenção); ▼ = reduziu (positivo). Para receitas: ▲ = cresceu (positivo)." />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Período 1 (atual)</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5">{label1}</p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
          <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Período 2 (comparação)</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5">{label2}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center gap-1 mb-2"><TypeBadge type="despesa" /></div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] text-slate-400">P1</p>
              <p className="text-base font-bold text-rose-600">{fmtCurrency(t1S)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">P2</p>
              <p className="text-base font-bold text-slate-500">{fmtCurrency(t2S)}</p>
            </div>
          </div>
          {t2S > 0 && (
            <p className={`mt-2 text-xs font-bold ${varS > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {varS > 0 ? '▲' : '▼'} {Math.abs(varS).toFixed(1)}% vs P2
              <span className="text-[10px] font-normal text-slate-400 ml-1">
                {varS > 0 ? '(despesas aumentaram)' : '(despesas reduziram)'}
              </span>
            </p>
          )}
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center gap-1 mb-2"><TypeBadge type="receita" /></div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] text-slate-400">P1</p>
              <p className="text-base font-bold text-emerald-600">{fmtCurrency(t1E)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">P2</p>
              <p className="text-base font-bold text-slate-500">{fmtCurrency(t2E)}</p>
            </div>
          </div>
          {t2E > 0 && (
            <p className={`mt-2 text-xs font-bold ${varE > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {varE > 0 ? '▲' : '▼'} {Math.abs(varE).toFixed(1)}% vs P2
              <span className="text-[10px] font-normal text-slate-400 ml-1">
                {varE > 0 ? '(receitas cresceram)' : '(receitas reduziram)'}
              </span>
            </p>
          )}
        </div>
      </div>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">
        Evolução — P1 (sólido) vs P2 (claro)
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={merged} margin={{ top: 14, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="idx" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis tickFormatter={cfmt} tick={{ fontSize: 10, fill: '#94a3b8' }} width={56} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[180px]">
                  <p className="font-semibold text-slate-600 mb-2">Ponto {label}</p>
                  {payload.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                        <span className="text-slate-500">{p.name}</span>
                      </span>
                      <span className="font-bold">{fmtCurrency(p.value as number)}</span>
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {(saidasCur.length > 0 || saidasPrev.length > 0) && (
            <>
              <Bar dataKey="p1S" name="Despesas P1" fill="#f43f5e" radius={[4,4,0,0]}>
                <LabelList dataKey="p1S" position="top" formatter={rotuloFmt} style={{ fontSize: 8, fill: '#f43f5e', fontWeight: 700 }} />
              </Bar>
              <Bar dataKey="p2S" name="Despesas P2" fill="#fca5a5" radius={[4,4,0,0]} />
            </>
          )}
          {(entradasCur.length > 0 || entradasPrev.length > 0) && (
            <>
              <Bar dataKey="p1E" name="Receitas P1" fill="#10b981" radius={[4,4,0,0]}>
                <LabelList dataKey="p1E" position="top" formatter={rotuloFmt} style={{ fontSize: 8, fill: '#10b981', fontWeight: 700 }} />
              </Bar>
              <Bar dataKey="p2E" name="Receitas P2" fill="#86efac" radius={[4,4,0,0]} />
            </>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
interface ModalState {
  title: string; subtitle: string; transactions: Transaction[];
}

export function Dashboard({ saidas, entradas }: Props) {
  const refDate = new Date();

  const [mode, setMode]               = useState<PeriodMode>('preset');
  const [presetType, setPresetType]   = useState<PeriodType>('mes');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [compareStart, setCompareStart] = useState('');
  const [compareEnd, setCompareEnd]     = useState('');
  const [showComparison, setShowComparison] = useState(false);
  const [dowSource, setDowSource]     = useState<'entradas' | 'saidas'>('entradas');
  const [modal, setModal]             = useState<ModalState | null>(null);

  // Period bounds
  const { start, end } = useMemo(() => {
    if (mode === 'custom' && customStart && customEnd)
      return { start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59') };
    return getPeriodBounds(presetType, refDate);
  }, [mode, presetType, customStart, customEnd]);

  const { start: prevStart, end: prevEnd } = useMemo(() => {
    if (showComparison && compareStart && compareEnd)
      return { start: new Date(compareStart + 'T00:00:00'), end: new Date(compareEnd + 'T23:59:59') };
    if (mode === 'preset') return getPreviousPeriodBounds(presetType, refDate);
    const ms = end.getTime() - start.getTime();
    return { start: new Date(start.getTime() - ms), end: new Date(start.getTime() - 1) };
  }, [mode, presetType, showComparison, compareStart, compareEnd, start, end]);

  const gran: PeriodType = useMemo(() => {
    if (mode === 'custom' && customStart && customEnd) return autoGranularity(start, end);
    return chartGranularity(presetType);
  }, [mode, presetType, customStart, customEnd, start, end]);

  // Filtered — always split
  const saidasCur    = useMemo(() => filterByPeriod(saidas,   start, end),      [saidas, start, end]);
  const entradasCur  = useMemo(() => filterByPeriod(entradas, start, end),      [entradas, start, end]);
  const saidasPrev   = useMemo(() => filterByPeriod(saidas,   prevStart, prevEnd), [saidas, prevStart, prevEnd]);
  const entradasPrev = useMemo(() => filterByPeriod(entradas, prevStart, prevEnd), [entradas, prevStart, prevEnd]);

  const totalSaidas       = sumRealizado(saidasCur);
  const totalEntradas     = sumRealizado(entradasCur);
  const saldo             = totalEntradas - totalSaidas;
  const totalSaidasPrev   = sumRealizado(saidasPrev);
  const totalEntradasPrev = sumRealizado(entradasPrev);

  const saidasNat       = useMemo(() => getNaturezaComparativo(saidasCur, saidasPrev),  [saidasCur, saidasPrev]);
  const contaTotals     = useMemo(() => getContaTotals(saidasCur),                      [saidasCur]);

  // Fornecedores de Mercadoria: only COMPRA DE MERCADORIAS, grouped by fornecedor
  const saidasMercadoria = useMemo(() =>
    saidasCur.filter((t) => t.natureza.toUpperCase().trim() === 'COMPRA DE MERCADORIAS'),
    [saidasCur],
  );
  const topFornecedoresMercadoria = useMemo(() => getTopFornecedores(saidasMercadoria, 10), [saidasMercadoria]);

  // DRE category split for charts
  const dreMap     = useMemo(() => new Map(DRE_MAPEAMENTO.map((i) => [i.natureza.toUpperCase().trim(), i.categoria])), []);
  const dreMapFull = useMemo(() => new Map(DRE_MAPEAMENTO.map((i) => [i.natureza.toUpperCase().trim(), i])), []);
  const saidasOPEX     = useMemo(() => saidasCur.filter((t)  => dreMap.get(t.natureza.toUpperCase().trim()) === 'DESPESA_OPERACIONAL'),  [saidasCur, dreMap]);
  const saidasPrevOPEX = useMemo(() => saidasPrev.filter((t) => dreMap.get(t.natureza.toUpperCase().trim()) === 'DESPESA_OPERACIONAL'),  [saidasPrev, dreMap]);
  const saidasSGA      = useMemo(() => saidasCur.filter((t)  => { const item = dreMapFull.get(t.natureza.toUpperCase().trim()); return item?.categoria === 'DESPESA_ADMINISTRATIVA' && item.subcategoria !== 'Dividendos/Socios'; }), [saidasCur, dreMapFull]);
  const saidasPrevSGA  = useMemo(() => saidasPrev.filter((t) => { const item = dreMapFull.get(t.natureza.toUpperCase().trim()); return item?.categoria === 'DESPESA_ADMINISTRATIVA' && item.subcategoria !== 'Dividendos/Socios'; }), [saidasPrev, dreMapFull]);
  const opexNat = useMemo(() => getNaturezaComparativo(saidasOPEX, saidasPrevOPEX), [saidasOPEX, saidasPrevOPEX]);
  const sgaNat  = useMemo(() => getNaturezaComparativo(saidasSGA,  saidasPrevSGA),  [saidasSGA,  saidasPrevSGA]);

  const dowSaidas   = useMemo(() => getDayOfWeekTotals(saidasCur),   [saidasCur]);
  const dowEntradas = useMemo(() => getDayOfWeekTotals(entradasCur), [entradasCur]);
  const dowMerged   = useMemo(() => dowSaidas.map((d, i) => ({
    name: d.name,
    despesas: d.total,
    vendas: dowEntradas[i]?.total ?? 0,
  })), [dowSaidas, dowEntradas]);

  // Time series — with saldo as separate field for bar rendering
  const timeSeries = useMemo(
    () => buildTimeSeries(saidas, entradas, gran, start, end),
    [saidas, entradas, gran, start, end]
  );
  const showLabels = timeSeries.length <= 14;

  const hasData = saidas.length > 0 || entradas.length > 0;
  const currentLabel = formatRangeLabel(start, end);
  const compareLabel = formatRangeLabel(prevStart, prevEnd);

  function openNaturezaModal(natureza: string) {
    setModal({
      title: natureza,
      subtitle: `${currentLabel} · ${saidasNat.find((n) => n.natureza === natureza)?.count ?? 0} lançamentos`,
      transactions: saidasCur.filter((t) => t.natureza === natureza),
    });
  }

  function openFornecedorModal(fornecedor: string) {
    const txs = saidasCur.filter((t) => t.fornecedor === fornecedor);
    setModal({
      title: fornecedor,
      subtitle: `${currentLabel} · ${txs.length} lançamentos`,
      transactions: txs,
    });
  }

  return (
    <div className="space-y-5">
      <PeriodFilter
        mode={mode} presetType={presetType}
        customStart={customStart} customEnd={customEnd}
        compareStart={compareStart} compareEnd={compareEnd}
        showComparison={showComparison}
        onModeChange={setMode} onPresetChange={setPresetType}
        onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e); }}
        onCompareChange={(s, e) => { setCompareStart(s); setCompareEnd(e); }}
        onToggleComparison={() => setShowComparison((v) => !v)}
        currentLabel={currentLabel}
        compareLabel={showComparison ? compareLabel : undefined}
      />

      {!hasData && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500">Faça o upload das planilhas para iniciar a análise.</p>
          <p className="text-xs text-slate-400 mt-1">Aceita <strong>saídas</strong> (Contas a Pagar) e <strong>entradas</strong> (Quadro de Vendas Diário).</p>
        </div>
      )}

      {hasData && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Despesas" value={totalSaidas}
              variation={calcVariation(totalSaidas, totalSaidasPrev)} format="currency"
              tooltip={`Soma do campo 'V. Realizado' de todos os lançamentos de saída no período (${currentLabel}). Variação = (${fmtCurrency(totalSaidas)} − ${fmtCurrency(totalSaidasPrev)}) ÷ ${fmtCurrency(totalSaidasPrev)} × 100 = comparação com período anterior equivalente. ▲ = despesas aumentaram (atenção).`}
              accent="text-rose-600" icon={<TrendingDown size={14} />}
            />
            <KPICard label="Total Receitas" value={totalEntradas}
              variation={calcVariation(totalEntradas, totalEntradasPrev)} format="currency"
              tooltip={`Soma do campo 'Total' do quadro de vendas no período (${currentLabel}). Variação = (${fmtCurrency(totalEntradas)} − ${fmtCurrency(totalEntradasPrev)}) ÷ ${fmtCurrency(totalEntradasPrev)} × 100. ▲ = receitas cresceram (positivo).`}
              accent="text-emerald-600" icon={<TrendingUp size={14} />}
            />
            <KPICard label="Saldo Operacional" value={saldo} format="currency"
              tooltip={`Saldo = Receitas − Despesas = ${fmtCurrency(totalEntradas)} − ${fmtCurrency(totalSaidas)} = ${fmtCurrency(saldo)}. Positivo: receitas cobrem as despesas (superávit). Negativo: despesas superam receitas (déficit — atenção ao caixa).`}
              accent={saldo >= 0 ? 'text-emerald-600' : 'text-red-500'} icon={<Wallet size={14} />}
            />
            <KPICard label="Lançamentos" value={saidasCur.length + entradasCur.length} format="number"
              tooltip={`Total de registros no período: ${saidasCur.length} lançamentos de despesa + ${entradasCur.length} dias de receita = ${saidasCur.length + entradasCur.length} registros.`}
              accent="text-violet-600" icon={<ArrowLeftRight size={14} />}
            />
          </div>

          {/* Comparison Panel */}
          {showComparison && (
            <ComparisonPanel
              label1={currentLabel} label2={compareLabel}
              saidasCur={saidasCur} saidasPrev={saidasPrev}
              entradasCur={entradasCur} entradasPrev={entradasPrev}
              gran={gran} start1={start} end1={end} start2={prevStart} end2={prevEnd}
            />
          )}

          {/* ─── Evolução Temporal ─── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={16} className="text-rose-500" />
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Evolução Temporal</h2>
              <InfoTooltip text={`Linhas: Despesas (vermelho) e Receitas (verde) acumuladas por ${gran === 'dia' ? 'dia' : gran === 'semana' ? 'semana' : 'mês'}. Barras: Saldo = Receitas − Despesas. Verde ↑ = superávit naquele intervalo. Vermelho ↓ = déficit. Rótulos visíveis quando há ≤ 14 pontos.`} />
              <span className="ml-auto text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                Agrupado por {gran === 'dia' ? 'dia' : gran === 'semana' ? 'semana' : gran === 'mes' ? 'mês' : 'trimestre'}
              </span>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mb-3 text-[11px] text-slate-500">
              {saidas.length > 0 && <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-rose-500 inline-block rounded" />Despesas (Saídas)</span>}
              {entradas.length > 0 && <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-emerald-500 inline-block rounded" />Receitas (Vendas)</span>}
              {saidas.length > 0 && entradas.length > 0 && (
                <>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400/60 inline-block" />Saldo positivo (↑)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-400/60 inline-block" />Saldo negativo (↓)</span>
                </>
              )}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={timeSeries} margin={{ top: showLabels ? 22 : 10, right: 24, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} interval="preserveStartEnd" />
                <YAxis tickFormatter={cfmt} tick={{ fontSize: 11, fill: '#94a3b8' }} width={64} />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[220px]">
                        <p className="font-bold text-slate-700 mb-2">{label}</p>
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
                              <span className="text-slate-500">{p.name}</span>
                            </span>
                            <span className="font-bold text-slate-800">{fmtCurrency(p.value as number)}</span>
                          </div>
                        ))}
                        {(() => {
                          const s = payload.find((p) => p.dataKey === 'saidas');
                          const e = payload.find((p) => p.dataKey === 'entradas');
                          if (s && e) {
                            const saldo = (e.value as number) - (s.value as number);
                            return (
                              <div className="mt-2 pt-2 border-t border-slate-100">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Saldo = R−D</span>
                                  <span className={`font-bold ${saldo >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {fmtCurrency(saldo)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Fórmula: {fmtCurrency(e.value as number)} − {fmtCurrency(s.value as number)}</p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ) : null
                  }
                />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />

                {/* Saldo bars — green positive, red negative */}
                {saidas.length > 0 && entradas.length > 0 && (
                  <Bar dataKey="saldo" name="Saldo" radius={[3, 3, 0, 0]} maxBarSize={32}>
                    {timeSeries.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.saldo >= 0 ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)'}
                        stroke={entry.saldo >= 0 ? '#10b981' : '#f43f5e'}
                        strokeWidth={1}
                      />
                    ))}
                  </Bar>
                )}

                {saidas.length > 0 && (
                  <Line type="monotone" dataKey="saidas" name="Despesas" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: showLabels ? 3 : 2 }} activeDot={{ r: 5 }} legendType="none">
                    {showLabels && <LabelList dataKey="saidas" position="top" formatter={rotuloFmt} style={{ fontSize: 9, fill: '#f43f5e', fontWeight: 700 }} />}
                  </Line>
                )}
                {entradas.length > 0 && (
                  <Line type="monotone" dataKey="entradas" name="Receitas" stroke="#10b981" strokeWidth={2.5} dot={{ r: showLabels ? 3 : 2 }} activeDot={{ r: 5 }} legendType="none">
                    {showLabels && <LabelList dataKey="entradas" position="top" formatter={rotuloFmt} style={{ fontSize: 9, fill: '#10b981', fontWeight: 700 }} />}
                  </Line>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Day of week */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays size={16} className="text-rose-500" />
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Distribuição por Dia da Semana</h2>
              <InfoTooltip text="Soma acumulada no período selecionado por dia da semana. Permite identificar os dias com maior volume de receitas ou despesas. Cálculo: soma de V. Realizado de todos os lançamentos que caem naquele dia da semana no período." />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[11px] text-slate-400">Destacar:</span>
              <button onClick={() => setDowSource('entradas')}
                className={`text-[11px] font-semibold px-3 py-1 rounded-lg border transition-all ${dowSource === 'entradas' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                Receitas (Vendas)
              </button>
              <button onClick={() => setDowSource('saidas')}
                className={`text-[11px] font-semibold px-3 py-1 rounded-lg border transition-all ${dowSource === 'saidas' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                Despesas (Saídas)
              </button>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={dowMerged} margin={{ top: 20, right: 16, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickFormatter={cfmt} tick={{ fontSize: 11, fill: '#94a3b8' }} width={60} />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[170px]">
                        <p className="font-bold text-slate-700 mb-2">{label}</p>
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                              <span className="text-slate-500">{p.name}</span>
                            </span>
                            <span className="font-bold">{fmtCurrency(p.value as number)}</span>
                          </div>
                        ))}
                        <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
                          Soma acumulada no período — não é média diária
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {entradas.length > 0 && (
                  <Bar dataKey="vendas" name="Receitas (Vendas)" radius={[5,5,0,0]} fill={dowSource === 'entradas' ? '#10b981' : '#d1fae5'}>
                    {dowSource === 'entradas' && <LabelList dataKey="vendas" position="top" formatter={rotuloFmt} style={{ fontSize: 9, fontWeight: 700, fill: '#059669' }} />}
                  </Bar>
                )}
                {saidas.length > 0 && (
                  <Bar dataKey="despesas" name="Despesas (Saídas)" radius={[5,5,0,0]} fill={dowSource === 'saidas' ? '#f43f5e' : '#fecdd3'}>
                    {dowSource === 'saidas' && <LabelList dataKey="despesas" position="top" formatter={rotuloFmt} style={{ fontSize: 9, fontWeight: 700, fill: '#e11d48' }} />}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Despesas por categoria DRE — OPEX e SGA separados */}
          {saidas.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* OPEX */}
              {opexNat.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 size={15} className="text-rose-500" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Despesas Operacionais (OPEX)</h2>
                    <TypeBadge type="despesa" />
                    <InfoTooltip text="Naturezas classificadas como DESPESA_OPERACIONAL no mapeamento DRE: pessoal, ocupação, utilidades, marketing, logística, etc. Top 10 por valor realizado. Clique para ver lançamentos." />
                  </div>
                  <ResponsiveContainer width="100%" height={Math.max(240, opexNat.slice(0, 10).length * 30)}>
                    <BarChart
                      data={opexNat.slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 2, right: 90, left: 8, bottom: 2 }}
                      onClick={(data: unknown) => {
                        const d = data as { activePayload?: { payload?: { natureza?: string } }[] } | null;
                        const nat = d?.activePayload?.[0]?.payload?.natureza;
                        if (nat) openNaturezaModal(nat);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tickFormatter={cfmt} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis type="category" dataKey="natureza" width={150} tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(v: unknown) => { const s = String(v); return s.length > 22 ? s.slice(0, 22) + '…' : s; }}
                      />
                      <Tooltip content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[200px]">
                            <div className="flex items-center gap-1.5 mb-1"><TypeBadge type="despesa" /><span className="font-semibold text-slate-700">{label}</span></div>
                            <p className="text-[10px] text-slate-400 mb-1">OPEX — Despesa Operacional</p>
                            <p className="font-bold text-rose-600">{fmtCurrency(payload[0].value as number)}</p>
                            {(payload[0].payload as { previousTotal: number }).previousTotal > 0 && (() => {
                              const cur = payload[0].value as number;
                              const prev = (payload[0].payload as { previousTotal: number }).previousTotal;
                              const v = ((cur - prev) / prev) * 100;
                              return <p className={`text-[11px] font-bold mt-1 ${v > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{v > 0 ? '▲' : '▼'} {Math.abs(v).toFixed(1)}% vs período anterior</p>;
                            })()}
                            <p className="text-[10px] text-slate-400 mt-1 italic">Clique para ver lançamentos</p>
                          </div>
                        ) : null
                      } />
                      <Bar dataKey="total" name="OPEX" radius={[0, 5, 5, 0]}>
                        {opexNat.slice(0, 10).map((_, idx) => (
                          <Cell key={idx} fill={DESPESA_COLORS[idx % DESPESA_COLORS.length]} />
                        ))}
                        <LabelList dataKey="total" position="right" formatter={(v: unknown) => cfmt(v)} style={{ fontSize: 10, fontWeight: 600, fill: '#475569' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* SGA */}
              {sgaNat.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 size={15} className="text-violet-500" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Despesas Administrativas (SG&A)</h2>
                    <TypeBadge type="despesa" />
                    <InfoTooltip text="Naturezas classificadas como DESPESA_ADMINISTRATIVA no mapeamento DRE: contabilidade, TI, frota, viagens, associações, etc. Top 10 por valor realizado. Clique para ver lançamentos." />
                  </div>
                  <ResponsiveContainer width="100%" height={Math.max(240, sgaNat.slice(0, 10).length * 30)}>
                    <BarChart
                      data={sgaNat.slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 2, right: 90, left: 8, bottom: 2 }}
                      onClick={(data: unknown) => {
                        const d = data as { activePayload?: { payload?: { natureza?: string } }[] } | null;
                        const nat = d?.activePayload?.[0]?.payload?.natureza;
                        if (nat) openNaturezaModal(nat);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tickFormatter={cfmt} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis type="category" dataKey="natureza" width={150} tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(v: unknown) => { const s = String(v); return s.length > 22 ? s.slice(0, 22) + '…' : s; }}
                      />
                      <Tooltip content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[200px]">
                            <div className="flex items-center gap-1.5 mb-1"><TypeBadge type="despesa" /><span className="font-semibold text-slate-700">{label}</span></div>
                            <p className="text-[10px] text-slate-400 mb-1">SG&A — Despesa Administrativa</p>
                            <p className="font-bold text-violet-600">{fmtCurrency(payload[0].value as number)}</p>
                            {(payload[0].payload as { previousTotal: number }).previousTotal > 0 && (() => {
                              const cur = payload[0].value as number;
                              const prev = (payload[0].payload as { previousTotal: number }).previousTotal;
                              const v = ((cur - prev) / prev) * 100;
                              return <p className={`text-[11px] font-bold mt-1 ${v > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{v > 0 ? '▲' : '▼'} {Math.abs(v).toFixed(1)}% vs período anterior</p>;
                            })()}
                            <p className="text-[10px] text-slate-400 mt-1 italic">Clique para ver lançamentos</p>
                          </div>
                        ) : null
                      } />
                      <Bar dataKey="total" name="SG&A" radius={[0, 5, 5, 0]}>
                        {sgaNat.slice(0, 10).map((_, idx) => (
                          <Cell key={idx} fill={['#a78bfa','#c4b5fd','#8b5cf6','#7c3aed','#6d28d9','#5b21b6','#ddd6fe','#ede9fe','#7e22ce','#9333ea'][idx % 10]} />
                        ))}
                        <LabelList dataKey="total" position="right" formatter={(v: unknown) => cfmt(v)} style={{ fontSize: 10, fontWeight: 600, fill: '#475569' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Fallback: if no DRE mapping, show all naturezas */}
              {opexNat.length === 0 && sgaNat.length === 0 && saidasNat.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 xl:col-span-2">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 size={15} className="text-rose-500" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Despesas por Natureza</h2>
                    <TypeBadge type="despesa" />
                    <InfoTooltip text="Top 12 naturezas de despesa. Para ver separado por OPEX e SG&A, importe a base de saídas com as naturezas do mapeamento DRE." />
                  </div>
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={saidasNat.slice(0, 12)} layout="vertical" margin={{ top: 4, right: 90, left: 8, bottom: 4 }}
                      onClick={(data: unknown) => { const d = data as { activePayload?: { payload?: { natureza?: string } }[] } | null; const nat = d?.activePayload?.[0]?.payload?.natureza; if (nat) openNaturezaModal(nat); }}
                      style={{ cursor: 'pointer' }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tickFormatter={cfmt} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis type="category" dataKey="natureza" width={160} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: unknown) => { const s = String(v); return s.length > 23 ? s.slice(0, 23) + '…' : s; }} />
                      <Tooltip />
                      <Bar dataKey="total" name="Despesas" radius={[0, 6, 6, 0]}>
                        {saidasNat.slice(0, 12).map((_, idx) => <Cell key={idx} fill={DESPESA_COLORS[idx % DESPESA_COLORS.length]} />)}
                        <LabelList dataKey="total" position="right" formatter={(v: unknown) => cfmt(v)} style={{ fontSize: 10, fontWeight: 600, fill: '#475569' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Conta + Fornecedores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <SectionTitle icon={<CreditCard size={16} />} title="Despesas por Conta Bancária"
                badge={<TypeBadge type="despesa" />}
                tooltip={`Soma das despesas realizadas por cada conta de débito no período. Cálculo: soma de V. Realizado agrupada pelo campo 'Conta'. Permite identificar qual conta concentra mais pagamentos. Total no período: ${fmtCurrency(totalSaidas)}.`}
              />
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={contaTotals} margin={{ top: 20, right: 70, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="conta" tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v: unknown) => { const s = String(v); return s.length > 16 ? s.slice(0, 16) + '…' : s; }}
                  />
                  <YAxis tickFormatter={cfmt} tick={{ fontSize: 10, fill: '#94a3b8' }} width={55} />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[180px]">
                          <div className="flex items-center gap-1.5 mb-1"><TypeBadge type="despesa" /></div>
                          <p className="font-semibold text-slate-700">{label}</p>
                          <p className="font-bold text-rose-600">{fmtCurrency(payload[0].value as number)}</p>
                          <p className="text-slate-500 mt-1">
                            {totalSaidas > 0 ? (((payload[0].value as number) / totalSaidas) * 100).toFixed(1) : '0'}% do total de despesas
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">Cálculo: soma de V. Realizado onde Conta = "{label}"</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="total" name="Despesas" radius={[6,6,0,0]}>
                    {contaTotals.map((_, idx) => (
                      <Cell key={idx} fill={DESPESA_COLORS[idx % DESPESA_COLORS.length]} />
                    ))}
                    <LabelList dataKey="total" position="top" formatter={(v: unknown) => cfmt(v)} style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Fornecedores de Mercadoria */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <SectionTitle icon={<ShoppingCart size={16} />} title="Fornecedores de Mercadoria"
                badge={<TypeBadge type="despesa" />}
                tooltip={`Fornecedores com natureza 'COMPRA DE MERCADORIAS'. Mostra quem fornece o estoque da loja. Clique para ver os lançamentos individuais.`}
              />
              <div className="space-y-2 overflow-y-auto max-h-52">
                {topFornecedoresMercadoria.map((f, idx) => {
                  const maxVal = topFornecedoresMercadoria[0]?.total || 1;
                  const pct = (f.total / maxVal) * 100;
                  const totalMerc = saidasMercadoria.reduce((a, t) => a + t.vRealizado, 0);
                  const pctTotal = totalMerc > 0 ? (f.total / totalMerc) * 100 : 0;
                  return (
                    <button
                      key={f.fornecedor}
                      onClick={() => openFornecedorModal(f.fornecedor)}
                      className="flex items-center gap-3 w-full hover:bg-slate-50 rounded-xl px-2 py-1 transition-colors group text-left"
                      title="Clique para ver os lançamentos"
                    >
                      <span className="w-5 text-xs text-slate-400 font-semibold shrink-0 text-right">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate group-hover:text-emerald-600 transition-colors">{f.fornecedor}</p>
                        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-800">{fmtCurrency(f.total)}</p>
                        <p className="text-[10px] text-slate-400">{pctTotal.toFixed(1)}% do CMV</p>
                      </div>
                    </button>
                  );
                })}
                {topFornecedoresMercadoria.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">Nenhuma compra de mercadoria no período.</p>
                )}
              </div>
            </div>
          </div>

          {/* Detalhamento — top 15, scroll */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Store size={16} className="text-rose-500" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Detalhamento por Natureza</h2>
                <TypeBadge type="despesa" />
                <InfoTooltip text="Top 15 categorias de despesa do período atual. Clique em uma linha para ver os lançamentos individuais. Variação = (Atual − Anterior) ÷ Anterior × 100. ▲ vermelho = custo cresceu (atenção). ▼ verde = custo reduziu (economia). % Total = valor desta natureza ÷ total de saídas × 100." />
              </div>
              <span className="text-[10px] text-slate-400">Top 15 · Clique para detalhar</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-2 text-slate-500 font-semibold">
                      <span className="flex items-center gap-1">Natureza <InfoTooltip text="Categoria da despesa conforme campo 'Natureza' da planilha de Contas a Pagar." /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-slate-500 font-semibold">
                      <span className="inline-flex items-center gap-1">Qtd. <InfoTooltip text="Número de lançamentos individuais nesta natureza no período." /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-slate-500 font-semibold">
                      <span className="inline-flex items-center gap-1">Atual <InfoTooltip text="Soma de V. Realizado desta natureza no período selecionado." /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-slate-500 font-semibold">
                      <span className="inline-flex items-center gap-1">Anterior <InfoTooltip text="Soma de V. Realizado no período equivalente anterior (ex: mês passado se filtro = Mês)." /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-slate-500 font-semibold">
                      <span className="inline-flex items-center gap-1">Variação <InfoTooltip text="(Atual − Anterior) ÷ Anterior × 100. ▲ = custo cresceu. ▼ = custo reduziu." /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-slate-500 font-semibold">
                      <span className="inline-flex items-center gap-1">% Total <InfoTooltip text="Participação no total de despesas do período. Fórmula: valor desta natureza ÷ total saídas × 100." /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {saidasNat.slice(0, 15).map((n, idx) => {
                    const varDir = n.variation > 1 ? 'up' : n.variation < -1 ? 'down' : 'neutral';
                    return (
                      <tr
                        key={n.natureza}
                        onClick={() => openNaturezaModal(n.natureza)}
                        className={`border-b border-slate-50 cursor-pointer hover:bg-rose-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                        title="Clique para ver os lançamentos"
                      >
                        <td className="py-1.5 px-2 font-medium text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DESPESA_COLORS[idx % DESPESA_COLORS.length] }} />
                            {n.natureza}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-500">{n.count}</td>
                        <td className="py-1.5 px-2 text-right font-semibold text-slate-800">{fmtCurrency(n.total)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-400">
                          {n.previousTotal > 0 ? fmtCurrency(n.previousTotal) : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {n.previousTotal > 0 ? (
                            <span className={`inline-flex items-center gap-0.5 font-bold text-[11px] px-1.5 py-0.5 rounded-full ${
                              varDir === 'up' ? 'bg-red-50 text-red-600' : varDir === 'down' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {varDir === 'up' ? '▲' : varDir === 'down' ? '▼' : '●'}{Math.abs(n.variation).toFixed(1)}%
                            </span>
                          ) : <span className="text-slate-300 text-[10px]">novo</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <span className="text-slate-600 font-medium">{n.percentual.toFixed(1)}%</span>
                          <span className="text-slate-400 text-[10px] ml-1">das despesas</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-white">
                  <tr className="border-t-2 border-slate-200">
                    <td className="py-2 px-2 font-bold text-slate-800">Top 15</td>
                    <td className="py-2 px-2 text-right font-bold text-slate-700">{saidasNat.slice(0,15).reduce((a,n)=>a+n.count,0)}</td>
                    <td className="py-2 px-2 text-right font-bold text-rose-600">{fmtCurrency(saidasNat.slice(0,15).reduce((a,n)=>a+n.total,0))}</td>
                    <td className="py-2 px-2 text-right font-semibold text-slate-400">{fmtCurrency(saidasNat.slice(0,15).reduce((a,n)=>a+n.previousTotal,0))}</td>
                    <td className="py-2 px-2 text-right">
                      {(() => {
                        const c = saidasNat.slice(0,15).reduce((a,n)=>a+n.total,0);
                        const p = saidasNat.slice(0,15).reduce((a,n)=>a+n.previousTotal,0);
                        const v = calcVariation(c,p);
                        return p > 0 ? <span className={`font-bold text-[11px] ${v>0?'text-red-500':'text-emerald-600'}`}>{v>0?'▲':'▼'}{Math.abs(v).toFixed(1)}%</span> : null;
                      })()}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-slate-700">
                      {saidasNat.slice(0,15).reduce((a,n)=>a+n.percentual,0).toFixed(1)}%
                      <span className="text-slate-400 text-[10px] ml-1">das despesas</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </>
      )}

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
