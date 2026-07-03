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
  chartGranularity, autoGranularity, getDayOfWeekTotals, periodKey,
} from '../utils/analytics';
import { DRE_MAPEAMENTO } from '../utils/dreMapping';
import { KPICard } from '../components/KPICard';
import { PeriodFilter } from '../components/PeriodFilter';
import { TransactionModal } from '../components/TransactionModal';
import { InfoTooltip } from '../components/InfoTooltip';
import {
  TrendingDown, TrendingUp, Wallet, BarChart2,
  ArrowLeftRight, Store, CreditCard, CalendarDays,
  GitCompare, ShoppingCart,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  saidas: Transaction[];
  entradas: Transaction[];
}

// ─── Palettes ─────────────────────────────────────────────────────────────────
const SAIDA_COLORS = [
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

function TypeBadge({ type }: { type: 'saida' | 'entrada' }) {
  return type === 'saida' ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />SAÍDA
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />ENTRADA
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
        <InfoTooltip text="Confronto direto entre os dois períodos selecionados. Variação = (P1 − P2) ÷ P2 × 100. Para saídas: ▲ = aumentou (atenção); ▼ = reduziu (positivo). Para entradas: ▲ = cresceu (positivo)." />
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
          <div className="flex items-center gap-1 mb-2"><TypeBadge type="saida" /></div>
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
                {varS > 0 ? '(saídas aumentaram)' : '(saídas reduziram)'}
              </span>
            </p>
          )}
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center gap-1 mb-2"><TypeBadge type="entrada" /></div>
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
                {varE > 0 ? '(entradas cresceram)' : '(entradas reduziram)'}
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
              <Bar dataKey="p1S" name="Saídas P1" fill="#f43f5e" radius={[4,4,0,0]}>
                <LabelList dataKey="p1S" position="top" formatter={rotuloFmt} style={{ fontSize: 8, fill: '#f43f5e', fontWeight: 700 }} />
              </Bar>
              <Bar dataKey="p2S" name="Saídas P2" fill="#fca5a5" radius={[4,4,0,0]} />
            </>
          )}
          {(entradasCur.length > 0 || entradasPrev.length > 0) && (
            <>
              <Bar dataKey="p1E" name="Entradas P1" fill="#10b981" radius={[4,4,0,0]}>
                <LabelList dataKey="p1E" position="top" formatter={rotuloFmt} style={{ fontSize: 8, fill: '#10b981', fontWeight: 700 }} />
              </Bar>
              <Bar dataKey="p2E" name="Entradas P2" fill="#86efac" radius={[4,4,0,0]} />
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

// Dashboard sempre abre no semestre (01/01/2026 – 30/06/2026)
const SEMESTER_START = '2026-01-01';
const SEMESTER_END = '2026-06-30';

export function Dashboard({ saidas, entradas }: Props) {
  const refDate = new Date();

  const [mode, setMode]               = useState<PeriodMode>('custom');
  const [presetType, setPresetType]   = useState<PeriodType>('ano');
  const [customStart, setCustomStart] = useState(SEMESTER_START);
  const [customEnd, setCustomEnd]     = useState(SEMESTER_END);
  const [compareStart, setCompareStart] = useState('');
  const [compareEnd, setCompareEnd]     = useState('');
  const [showComparison, setShowComparison] = useState(false);
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

  function openContaModal(conta: string) {
    const txs = saidasCur.filter((t) => t.conta === conta);
    if (!txs.length) return;
    setModal({
      title: conta,
      subtitle: `Saídas por conta · ${currentLabel} · ${txs.length} lançamentos`,
      transactions: txs,
    });
  }

  const DOW_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  function openDowModal(dayName: string) {
    const idx = DOW_NAMES.indexOf(dayName);
    if (idx < 0) return;
    const eInDay = entradasCur.filter((t) => t.data.getDay() === idx);
    const sInDay = saidasCur.filter((t) => t.data.getDay() === idx);
    const txs = [...eInDay, ...sInDay];
    if (!txs.length) return;
    setModal({
      title: `${dayName} — Entradas e Saídas`,
      subtitle: `${currentLabel} · ${eInDay.length} entradas · ${sInDay.length} saídas`,
      transactions: txs,
    });
  }

  function openPeriodoModal(periodo: string) {
    const sInP = saidasCur.filter((t) => periodKey(t.data, gran) === periodo);
    const eInP = entradasCur.filter((t) => periodKey(t.data, gran) === periodo);
    const txs = [...eInP, ...sInP];
    if (!txs.length) return;
    setModal({
      title: `Período ${periodo}`,
      subtitle: `${eInP.length} entradas · ${sInP.length} saídas`,
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
            <KPICard label="Total Saídas" value={totalSaidas}
              variation={calcVariation(totalSaidas, totalSaidasPrev)} format="currency"
              tooltip={`Soma do campo 'V. Realizado' de todos os lançamentos de saída no período (${currentLabel}). Variação = (${fmtCurrency(totalSaidas)} − ${fmtCurrency(totalSaidasPrev)}) ÷ ${fmtCurrency(totalSaidasPrev)} × 100 = comparação com período anterior equivalente. ▲ = saídas aumentaram (atenção).`}
              accent="text-rose-600" icon={<TrendingDown size={14} />}
            />
            <KPICard label="Total Entradas" value={totalEntradas}
              variation={calcVariation(totalEntradas, totalEntradasPrev)} format="currency"
              tooltip={`Soma do campo 'Total' do quadro de vendas no período (${currentLabel}). Variação = (${fmtCurrency(totalEntradas)} − ${fmtCurrency(totalEntradasPrev)}) ÷ ${fmtCurrency(totalEntradasPrev)} × 100. ▲ = entradas cresceram (positivo).`}
              accent="text-emerald-600" icon={<TrendingUp size={14} />}
            />
            <KPICard label="Saldo Operacional" value={saldo} format="currency"
              tooltip={`Saldo = Entradas − Saídas = ${fmtCurrency(totalEntradas)} − ${fmtCurrency(totalSaidas)} = ${fmtCurrency(saldo)}. Positivo: entradas cobrem as saídas (superávit). Negativo: saídas superam entradas (déficit — atenção ao caixa).`}
              accent={saldo >= 0 ? 'text-emerald-600' : 'text-red-500'} icon={<Wallet size={14} />}
            />
            <KPICard label="Lançamentos" value={saidasCur.length + entradasCur.length} format="number"
              tooltip={`Total de registros no período: ${saidasCur.length} lançamentos de saída + ${entradasCur.length} dias de entrada = ${saidasCur.length + entradasCur.length} registros.`}
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
              <InfoTooltip text={`Linhas: Saídas (vermelho) e Entradas (verde) acumuladas por ${gran === 'dia' ? 'dia' : gran === 'semana' ? 'semana' : 'mês'}. Barras: Saldo = Entradas − Saídas. Verde ↑ = superávit naquele intervalo. Vermelho ↓ = déficit. Rótulos visíveis quando há ≤ 14 pontos.`} />
              <span className="ml-auto text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                Agrupado por {gran === 'dia' ? 'dia' : gran === 'semana' ? 'semana' : gran === 'mes' ? 'mês' : 'trimestre'}
              </span>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mb-3 text-[11px] text-slate-500">
              {saidas.length > 0 && <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-rose-500 inline-block rounded" />Saídas</span>}
              {entradas.length > 0 && <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-emerald-500 inline-block rounded" />Entradas (Vendas)</span>}
              {saidas.length > 0 && entradas.length > 0 && (
                <>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400/60 inline-block" />Saldo positivo (↑)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-400/60 inline-block" />Saldo negativo (↓)</span>
                </>
              )}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={timeSeries} margin={{ top: showLabels ? 22 : 10, right: 24, left: 8, bottom: 5 }}
                onClick={(d: unknown) => { const a = d as { activeLabel?: string } | null; if (a?.activeLabel) openPeriodoModal(a.activeLabel); }}
                style={{ cursor: 'pointer' }}>
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
                  <Line type="monotone" dataKey="saidas" name="Saídas" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: showLabels ? 3 : 2 }} activeDot={{ r: 5 }} legendType="none">
                    {showLabels && <LabelList dataKey="saidas" position="top" formatter={rotuloFmt} style={{ fontSize: 9, fill: '#f43f5e', fontWeight: 700 }} />}
                  </Line>
                )}
                {entradas.length > 0 && (
                  <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#10b981" strokeWidth={2.5} dot={{ r: showLabels ? 3 : 2 }} activeDot={{ r: 5 }} legendType="none">
                    {showLabels && <LabelList dataKey="entradas" position="top" formatter={rotuloFmt} style={{ fontSize: 9, fill: '#10b981', fontWeight: 700 }} />}
                  </Line>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Day of week */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays size={16} className="text-rose-500" />
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Distribuição por Dia da Semana</h2>
              <InfoTooltip text="Comparativo de entradas (verde) e saídas (vermelho) acumuladas por dia da semana no período. Cálculo: soma de V. Realizado de todos os lançamentos que caem naquele dia da semana. Clique numa barra para ver os lançamentos." />
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={dowMerged} margin={{ top: 24, right: 16, left: 8, bottom: 5 }}
                onClick={(d: unknown) => { const a = d as { activeLabel?: string } | null; if (a?.activeLabel) openDowModal(a.activeLabel); }}
                style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickFormatter={cfmt} tick={{ fontSize: 11, fill: '#94a3b8' }} width={60} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
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
                        <p className="text-[10px] text-slate-400 mt-1 italic">Clique para ver os lançamentos</p>
                      </div>
                    ) : null
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {entradas.length > 0 && (
                  <Bar dataKey="vendas" name="Entradas (Vendas)" radius={[5,5,0,0]} fill="#10b981">
                    <LabelList dataKey="vendas" position="top" formatter={rotuloFmt} style={{ fontSize: 9, fontWeight: 700, fill: '#059669' }} />
                  </Bar>
                )}
                {saidas.length > 0 && (
                  <Bar dataKey="despesas" name="Saídas" radius={[5,5,0,0]} fill="#f43f5e">
                    <LabelList dataKey="despesas" position="top" formatter={rotuloFmt} style={{ fontSize: 9, fontWeight: 700, fill: '#e11d48' }} />
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Saídas por categoria DRE — OPEX e SGA separados */}
          {saidas.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* OPEX */}
              {opexNat.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 size={15} className="text-rose-500" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Saídas Operacionais (OPEX)</h2>
                    <TypeBadge type="saida" />
                    <InfoTooltip text="Saídas classificadas como Operacionais no mapeamento DRE: pessoal, ocupação, utilidades, marketing, logística, etc. Top 10 por valor realizado. Clique para ver lançamentos." />
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
                            <div className="flex items-center gap-1.5 mb-1"><TypeBadge type="saida" /><span className="font-semibold text-slate-700">{label}</span></div>
                            <p className="text-[10px] text-slate-400 mb-1">OPEX — Saída Operacional</p>
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
                          <Cell key={idx} fill={SAIDA_COLORS[idx % SAIDA_COLORS.length]} />
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
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Saídas Administrativas (SG&A)</h2>
                    <TypeBadge type="saida" />
                    <InfoTooltip text="Saídas classificadas como Administrativas no mapeamento DRE: contabilidade, TI, frota, viagens, associações, etc. Top 10 por valor realizado. Clique para ver lançamentos." />
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
                            <div className="flex items-center gap-1.5 mb-1"><TypeBadge type="saida" /><span className="font-semibold text-slate-700">{label}</span></div>
                            <p className="text-[10px] text-slate-400 mb-1">SG&A — Saída Administrativa</p>
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
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Saídas por Natureza</h2>
                    <TypeBadge type="saida" />
                    <InfoTooltip text="Top 12 naturezas de saída. Para ver separado por OPEX e SG&A, importe a base de saídas com as naturezas do mapeamento DRE." />
                  </div>
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={saidasNat.slice(0, 12)} layout="vertical" margin={{ top: 4, right: 90, left: 8, bottom: 4 }}
                      onClick={(data: unknown) => { const d = data as { activePayload?: { payload?: { natureza?: string } }[] } | null; const nat = d?.activePayload?.[0]?.payload?.natureza; if (nat) openNaturezaModal(nat); }}
                      style={{ cursor: 'pointer' }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tickFormatter={cfmt} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis type="category" dataKey="natureza" width={160} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: unknown) => { const s = String(v); return s.length > 23 ? s.slice(0, 23) + '…' : s; }} />
                      <Tooltip />
                      <Bar dataKey="total" name="Saídas" radius={[0, 6, 6, 0]}>
                        {saidasNat.slice(0, 12).map((_, idx) => <Cell key={idx} fill={SAIDA_COLORS[idx % SAIDA_COLORS.length]} />)}
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
              <SectionTitle icon={<CreditCard size={16} />} title="Saídas por Conta Bancária"
                badge={<TypeBadge type="saida" />}
                tooltip={`Soma das saídas realizadas por cada conta de débito no período. Cálculo: soma de V. Realizado agrupada pelo campo 'Conta'. Permite identificar qual conta concentra mais pagamentos. Total no período: ${fmtCurrency(totalSaidas)}.`}
              />
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={contaTotals} margin={{ top: 20, right: 70, left: 8, bottom: 5 }}
                  onClick={(d: unknown) => { const a = d as { activeLabel?: string } | null; if (a?.activeLabel) openContaModal(a.activeLabel); }}
                  style={{ cursor: 'pointer' }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="conta" tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v: unknown) => { const s = String(v); return s.length > 16 ? s.slice(0, 16) + '…' : s; }}
                  />
                  <YAxis tickFormatter={cfmt} tick={{ fontSize: 10, fill: '#94a3b8' }} width={55} />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[180px]">
                          <div className="flex items-center gap-1.5 mb-1"><TypeBadge type="saida" /></div>
                          <p className="font-semibold text-slate-700">{label}</p>
                          <p className="font-bold text-rose-600">{fmtCurrency(payload[0].value as number)}</p>
                          <p className="text-slate-500 mt-1">
                            {totalSaidas > 0 ? (((payload[0].value as number) / totalSaidas) * 100).toFixed(1) : '0'}% do total de saídas
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">Cálculo: soma de V. Realizado onde Conta = "{label}"</p>
                          <p className="text-[10px] text-slate-400 mt-1 italic">Clique para ver os lançamentos</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="total" name="Saídas" radius={[6,6,0,0]}>
                    {contaTotals.map((_, idx) => (
                      <Cell key={idx} fill={SAIDA_COLORS[idx % SAIDA_COLORS.length]} />
                    ))}
                    <LabelList dataKey="total" position="top" formatter={(v: unknown) => cfmt(v)} style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Fornecedores de Mercadoria */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <SectionTitle icon={<ShoppingCart size={16} />} title="Fornecedores de Mercadoria"
                badge={<TypeBadge type="saida" />}
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
                        <p className="text-[10px] text-slate-400">{pctTotal.toFixed(1)}% do CMC</p>
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
                <TypeBadge type="saida" />
                <InfoTooltip text="Top 15 categorias de saída do período atual. Clique em uma linha para ver os lançamentos individuais. Variação = (Atual − Anterior) ÷ Anterior × 100. ▲ vermelho = saída cresceu (atenção). ▼ verde = saída reduziu (economia). % Total = valor desta natureza ÷ total de saídas × 100." />
              </div>
              <span className="text-[10px] text-slate-400">Top 15 · Clique para detalhar</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-2 text-slate-500 font-semibold">
                      <span className="flex items-center gap-1">Natureza <InfoTooltip text="Categoria da saída conforme campo 'Natureza' da planilha de Contas a Pagar." /></span>
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
                      <span className="inline-flex items-center gap-1">Variação <InfoTooltip text="(Atual − Anterior) ÷ Anterior × 100. ▲ = saída cresceu. ▼ = saída reduziu." /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-slate-500 font-semibold">
                      <span className="inline-flex items-center gap-1">% Total <InfoTooltip text="Participação no total de saídas do período. Fórmula: valor desta natureza ÷ total saídas × 100." /></span>
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
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SAIDA_COLORS[idx % SAIDA_COLORS.length] }} />
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
                          <span className="text-slate-400 text-[10px] ml-1">das saídas</span>
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
                      <span className="text-slate-400 text-[10px] ml-1">das saídas</span>
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
