import { useMemo } from 'react';
import type { Transaction } from '../types';
import { buildDRE } from '../utils/dreMapping';
import { fmtCurrency } from '../utils/analytics';
import {
  Brain, AlertTriangle,
  CheckCircle2, ArrowUpRight, ArrowDownRight, Minus,
  Target, Zap, DollarSign, Activity,
} from 'lucide-react';

interface Props {
  saidas: Transaction[];
  entradas: Transaction[];
}

// ── Benchmarks varejo moda Brasil ────────────────────────────────────────────
const BENCH = { margBruta: 55, ebita: 12, cmvRatio: 45, opexRatio: 28, sgaRatio: 12 };

// ── Utilitários ───────────────────────────────────────────────────────────────

function pct(val: number, base: number) {
  return base > 0 ? (val / base) * 100 : 0;
}

function fmtPct(v: number, decimals = 1) {
  return `${v.toFixed(decimals)}%`;
}

function delta(cur: number, prev: number) {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

// ── Score ─────────────────────────────────────────────────────────────────────

function calcScore(margBruta: number, ebita: number, resultado: number, revTrend: number | null) {
  // Margem bruta: 0-40 pts (50%+ = max)
  const sMarg = Math.min(40, Math.max(0, (margBruta / 50) * 40));
  // EBITA: 0-35 pts (12%+ = max)
  const sEbit = ebita >= 12 ? 35 : ebita >= 0 ? (ebita / 12) * 35 : 0;
  // Resultado positivo: 0-15 pts
  const sRes = resultado > 0 ? 15 : resultado > -5000 ? 8 : 0;
  // Tendência de receita: 0-10 pts
  const sTrend = revTrend === null ? 5 : revTrend > 5 ? 10 : revTrend > 0 ? 7 : revTrend > -5 ? 4 : 0;
  return Math.round(sMarg + sEbit + sRes + sTrend);
}

function scoreLabel(s: number): { text: string; color: string; ring: string; bg: string } {
  if (s >= 70) return { text: 'Saudável', color: '#10b981', ring: '#6ee7b7', bg: 'from-emerald-900 via-emerald-800 to-teal-900' };
  if (s >= 45) return { text: 'Atenção', color: '#f59e0b', ring: '#fcd34d', bg: 'from-amber-900 via-amber-800 to-orange-900' };
  return { text: 'Crítico', color: '#f43f5e', ring: '#fda4af', bg: 'from-rose-900 via-rose-800 to-red-900' };
}

// ── Alerta ────────────────────────────────────────────────────────────────────

interface Alert { level: 'critical' | 'warn' | 'ok'; title: string; body: string }

// ── Subcomponentes ────────────────────────────────────────────────────────────

function TrendIcon({ v }: { v: number | null }) {
  if (v === null) return <Minus size={13} className="text-slate-400" />;
  if (v > 2) return <ArrowUpRight size={13} className="text-emerald-500" />;
  if (v < -2) return <ArrowDownRight size={13} className="text-rose-500" />;
  return <Minus size={13} className="text-slate-400" />;
}

function VsBench({ val, bench, inverted = false }: { val: number; bench: number; inverted?: boolean }) {
  const diff = val - bench;
  const isGood = inverted ? diff < 0 : diff > 0;
  const isNeutral = Math.abs(diff) < 2;
  if (isNeutral) return <span className="text-[10px] text-slate-400">≈ benchmark</span>;
  return (
    <span className={`text-[10px] font-semibold ${isGood ? 'text-emerald-600' : 'text-rose-500'}`}>
      {isGood ? '+' : ''}{diff.toFixed(1)}pp vs benchmark
    </span>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const cfg = {
    critical: { icon: <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />, border: 'border-rose-200 bg-rose-50', titleCls: 'text-rose-700' },
    warn:     { icon: <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />, border: 'border-amber-200 bg-amber-50', titleCls: 'text-amber-700' },
    ok:       { icon: <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />, border: 'border-emerald-200 bg-emerald-50', titleCls: 'text-emerald-700' },
  }[alert.level];

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 ${cfg.border}`}>
      {cfg.icon}
      <div>
        <p className={`text-xs font-bold ${cfg.titleCls}`}>{alert.title}</p>
        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{alert.body}</p>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function InsightsPage({ saidas, entradas }: Props) {
  const dre = useMemo(() => buildDRE(saidas, entradas), [saidas, entradas]);
  const hasData = saidas.length > 0 || entradas.length > 0;

  const L = (n: number) => dre.lines.find((l) => l.linha === n);

  // ── Totais acumulados ──────────────────────────────────────────────────────
  const totalReceita   = L(1)?.total ?? 0;
  const totalCMV       = L(4)?.total ?? 0;
  const totalOPEX      = L(6)?.total ?? 0;
  const totalSGA       = L(8)?.total ?? 0;
  const totalFin       = L(11)?.total ?? 0;
  const totalCAPEX     = L(13)?.total ?? 0;
  const lucroBruto     = L(5)?.total ?? 0;
  const ebita          = L(9)?.total ?? 0;
  const resultado      = L(17)?.total ?? 0;
  const totalSaidas    = saidas.reduce((a, t) => a + t.vRealizado, 0);

  // ── Margens ───────────────────────────────────────────────────────────────
  const margBruta  = pct(lucroBruto, totalReceita);
  const margEbita  = pct(ebita, totalReceita);
  const margRes    = pct(resultado, totalReceita);
  const cmvRatio   = pct(totalCMV, totalReceita);
  const opexRatio  = pct(totalOPEX, totalReceita);
  const sgaRatio   = pct(totalSGA, totalReceita);
  const finRatio   = pct(totalFin, totalReceita);

  // ── Por mês ───────────────────────────────────────────────────────────────
  const receitaByMonth   = L(1)?.months ?? {};
  const resultadoByMonth = L(17)?.months ?? {};
  const { monthKeys, monthLabels } = dre;
  const nMonths = monthKeys.length;

  // Tendência de receita: últimos 3 vs anteriores 3
  const last3  = monthKeys.slice(-3);
  const prev3  = monthKeys.slice(-6, -3);
  const revLast  = last3.reduce((a, mk) => a + (receitaByMonth[mk] ?? 0), 0) / Math.max(1, last3.length);
  const revPrev  = prev3.reduce((a, mk) => a + (receitaByMonth[mk] ?? 0), 0) / Math.max(1, prev3.length);
  const revTrend = prev3.length > 0 ? delta(revLast, revPrev) : null;

  // Melhor e pior mês (por resultado)
  const monthPerf = monthKeys
    .filter((mk) => (receitaByMonth[mk] ?? 0) > 0)
    .map((mk) => ({ mk, label: monthLabels[monthKeys.indexOf(mk)], resultado: resultadoByMonth[mk] ?? 0, receita: receitaByMonth[mk] ?? 0 }))
    .sort((a, b) => b.resultado - a.resultado);

  const melhorMes = monthPerf[0] ?? null;
  const piorMes   = monthPerf[monthPerf.length - 1] ?? null;

  // Meses positivos / negativos
  const mesesPos = monthKeys.filter((mk) => (resultadoByMonth[mk] ?? 0) > 0).length;
  const mesesNeg = monthKeys.filter((mk) => (resultadoByMonth[mk] ?? 0) < 0).length;

  // ── Score ─────────────────────────────────────────────────────────────────
  const score = calcScore(margBruta, margEbita, resultado, revTrend);
  const sl    = scoreLabel(score);

  // ── Top despesas por natureza ─────────────────────────────────────────────
  const topDespesas = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of saidas) map.set(t.natureza || '?', (map.get(t.natureza || '?') ?? 0) + t.vRealizado);
    return Array.from(map.entries())
      .map(([nat, val]) => ({ nat, val, pct: totalSaidas > 0 ? (val / totalSaidas) * 100 : 0 }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 6);
  }, [saidas, totalSaidas]);

  // ── Alertas dinâmicos ─────────────────────────────────────────────────────
  const alerts: Alert[] = useMemo(() => {
    const list: Alert[] = [];

    if (totalReceita === 0) {
      list.push({ level: 'warn', title: 'Sem dados de receita', body: 'Importe a planilha de entradas para ver análise completa de margens.' });
      return list;
    }

    if (margBruta < 40)
      list.push({ level: 'critical', title: `Margem Bruta em ${fmtPct(margBruta)} — abaixo do aceitável`, body: `Para varejo de moda, a margem bruta ideal é acima de 50%. O CMV está consumindo ${fmtPct(cmvRatio)} da receita. Revise markup de produto ou mix de mercadoria.` });
    else if (margBruta < BENCH.margBruta)
      list.push({ level: 'warn', title: `Margem Bruta em ${fmtPct(margBruta)} — pode melhorar`, body: `Você está ${(BENCH.margBruta - margBruta).toFixed(1)}pp abaixo do benchmark. Cada ponto percentual de margem bruta recuperado representa ${fmtCurrency((totalReceita * 0.01))} de lucro adicional.` });

    if (margEbita < 0)
      list.push({ level: 'critical', title: `EBITA negativo (${fmtPct(margEbita)}) — operação no prejuízo`, body: `As despesas operacionais e administrativas superam o lucro bruto. A loja gasta mais para funcionar do que ganha com a venda das peças.` });
    else if (margEbita < 5)
      list.push({ level: 'warn', title: `EBITA em ${fmtPct(margEbita)} — margem estreita`, body: `Qualquer variação de receita ou aumento de custo vira prejuízo. O ideal para varejo saudável é 10-15%.` });

    if (opexRatio > 35)
      list.push({ level: 'critical', title: `OPEX em ${fmtPct(opexRatio)} da receita — muito pesado`, body: `Despesas operacionais (pessoal, aluguel, utilidades) estão consumindo mais de 35% do faturamento. Revise estrutura de pessoal e contratos fixos.` });
    else if (opexRatio > BENCH.opexRatio)
      list.push({ level: 'warn', title: `OPEX em ${fmtPct(opexRatio)} — acima do benchmark`, body: `Benchmark para varejo de moda é ${fmtPct(BENCH.opexRatio)}. Diferença de ${(opexRatio - BENCH.opexRatio).toFixed(1)}pp representa ${fmtCurrency(totalReceita * (opexRatio - BENCH.opexRatio) / 100)} em custos acima do esperado.` });

    if (revTrend !== null && revTrend < -10)
      list.push({ level: 'critical', title: `Receita caindo ${fmtPct(Math.abs(revTrend))} nos últimos meses`, body: `A média mensal dos últimos 3 meses é ${fmtPct(Math.abs(revTrend))} menor que os 3 meses anteriores. Tendência de queda consistente exige ação imediata.` });
    else if (revTrend !== null && revTrend < -3)
      list.push({ level: 'warn', title: `Receita com tendência de queda`, body: `Queda de ${fmtPct(Math.abs(revTrend))} na média mensal. Fique de olho nos próximos meses.` });

    if (mesesNeg > 0 && nMonths > 0)
      list.push({ level: mesesNeg > nMonths / 2 ? 'critical' : 'warn', title: `${mesesNeg} de ${nMonths} ${nMonths === 1 ? 'mês' : 'meses'} com resultado negativo`, body: `${mesesNeg === 1 ? 'Um mês' : `${mesesNeg} meses`} fechou${mesesNeg > 1 ? 'ram' : ''} no vermelho. Avalie se há sazonalidade ou se é tendência.` });

    if (totalCAPEX > 0 && pct(totalCAPEX, totalReceita) > 10)
      list.push({ level: 'warn', title: `CAPEX alto: ${fmtPct(pct(totalCAPEX, totalReceita))} da receita em investimentos`, body: `Período com investimento relevante em equipamentos. Certifique-se de que o retorno esperado está mapeado.` });

    if (list.length === 0)
      list.push({ level: 'ok', title: 'Operação dentro dos parâmetros esperados', body: 'Nenhum alerta crítico identificado. Mantenha o acompanhamento mensal para detectar desvios antes que se tornem problemas.' });

    return list;
  }, [totalReceita, margBruta, margEbita, cmvRatio, opexRatio, revTrend, mesesNeg, nMonths, totalCAPEX, totalSaidas]);

  // ── Perguntas estratégicas ────────────────────────────────────────────────
  const questions = [
    { q: 'Você sabe o custo real por peça vendida — incluindo frete, embalagem e mão de obra?', tag: 'CMV' },
    { q: 'Qual categoria de produto tem a maior margem bruta? Você está vendendo mais dela?', tag: 'Produto' },
    { q: `Nos ${mesesNeg > 0 ? mesesNeg : 'eventuais'} meses negativos, o que aconteceu? Sazonalidade ou custo pontual?`, tag: 'Resultado' },
    { q: 'Seu maior custo fixo cresceu mais rápido que a receita nos últimos 3 meses?', tag: 'OPEX' },
    { q: 'A retirada de sócios está compatível com o caixa gerado pelo negócio?', tag: 'Caixa' },
  ];

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Brain size={48} className="text-slate-200" />
        <p className="text-sm font-semibold text-slate-500">Carregue as planilhas para gerar o fechamento executivo</p>
        <p className="text-xs text-slate-400 max-w-sm text-center">
          Importe saídas e entradas. O sistema analisa toda a base e entrega os insights mais importantes para o negócio.
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-6">

      {/* ── Hero: Score + Veredicto ─────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${sl.bg} rounded-2xl p-6 text-white shadow-xl`}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">

          {/* Score */}
          <div className="flex items-center gap-5 shrink-0">
            <div
              className="w-24 h-24 rounded-full flex flex-col items-center justify-center shrink-0 border-4"
              style={{ borderColor: sl.ring, background: 'rgba(0,0,0,0.25)' }}
            >
              <span className="text-3xl font-black leading-none" style={{ color: sl.color }}>{score}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-0.5">/ 100</span>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest opacity-50 mb-1">Saúde Financeira</p>
              <p className="text-2xl font-black leading-tight" style={{ color: sl.color }}>{sl.text}</p>
              <p className="text-[11px] opacity-60 mt-1">
                {nMonths > 0 ? `${nMonths} ${nMonths === 1 ? 'mês' : 'meses'} analisados` : 'Dados carregados'}
                {totalReceita > 0 ? ` · ${fmtCurrency(totalReceita)} em receita` : ''}
              </p>
            </div>
          </div>

          <div className="w-px h-16 bg-white/10 hidden lg:block" />

          {/* Headline metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
            {[
              { label: 'Margem Bruta',   val: fmtPct(margBruta),  sub: `benchmark ${fmtPct(BENCH.margBruta)}`, ok: margBruta >= BENCH.margBruta },
              { label: 'EBITA',          val: fmtPct(margEbita),  sub: `benchmark ${fmtPct(BENCH.ebita)}`,     ok: margEbita >= BENCH.ebita },
              { label: 'Resultado',      val: fmtPct(margRes),    sub: resultado >= 0 ? 'positivo' : 'negativo', ok: resultado >= 0 },
              { label: 'Tendência Rec.', val: revTrend !== null ? `${revTrend > 0 ? '+' : ''}${revTrend.toFixed(1)}%` : '—', sub: 'últimos 3 meses', ok: revTrend === null || revTrend >= 0 },
            ].map((m) => (
              <div key={m.label} className="bg-white/10 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-50">{m.label}</p>
                <p className={`text-xl font-black mt-0.5 ${m.ok ? 'text-white' : 'text-rose-300'}`}>{m.val}</p>
                <p className="text-[10px] opacity-40 mt-0.5">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Radiografia: para cada R$100 que entram ────────────────────────── */}
      {totalReceita > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <DollarSign size={15} className="text-rose-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Para cada R$100 que entram na loja…</h2>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Custo de Mercadoria (CMV)',  val: cmvRatio,   color: '#f43f5e', bench: BENCH.cmvRatio,   invertido: true,  icon: '📦' },
              { label: 'Despesas Operacionais (OPEX)', val: opexRatio, color: '#fb923c', bench: BENCH.opexRatio,  invertido: true,  icon: '🏪' },
              { label: 'Desp. Administrativas (SGA)', val: sgaRatio,  color: '#a78bfa', bench: BENCH.sgaRatio,   invertido: true,  icon: '💼' },
              { label: 'Despesas Financeiras',        val: finRatio,  color: '#94a3b8', bench: 3,                invertido: true,  icon: '🏦' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-base w-6 text-center shrink-0">{item.icon}</span>
                <div className="w-44 shrink-0">
                  <p className="text-[11px] text-slate-600 font-medium leading-tight">{item.label}</p>
                  <VsBench val={item.val} bench={item.bench} inverted={item.invertido} />
                </div>
                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, item.val)}%`, background: item.color }}
                  />
                </div>
                <span className="text-sm font-bold text-slate-800 w-14 text-right shrink-0">
                  R${item.val.toFixed(1)}
                </span>
              </div>
            ))}

            {/* Linha de resultado */}
            <div className="mt-2 pt-3 border-t border-slate-100 flex items-center gap-3">
              <span className="text-base w-6 text-center shrink-0">{resultado >= 0 ? '✅' : '🚨'}</span>
              <div className="w-44 shrink-0">
                <p className="text-[11px] font-bold text-slate-800">Sobra para o negócio</p>
                <p className={`text-[10px] font-semibold ${resultado >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {resultado >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
                </p>
              </div>
              <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, Math.abs(margRes)))}%`,
                    background: resultado >= 0 ? '#10b981' : '#f43f5e',
                  }}
                />
              </div>
              <span className={`text-sm font-black w-14 text-right shrink-0 ${resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                R${margRes.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Grid: Alertas + Top custos ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Alertas */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={15} className="text-amber-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Radar de Alertas</h2>
          </div>
          <div className="space-y-2.5">
            {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
          </div>
        </div>

        {/* Top custos */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={15} className="text-rose-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Maiores Custos do Período</h2>
          </div>
          <div className="space-y-2.5">
            {topDespesas.map((d, i) => (
              <div key={d.nat} className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-400 w-4 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[11px] font-semibold text-slate-700 truncate">{d.nat}</p>
                    <p className="text-[11px] font-bold text-slate-800 shrink-0">{fmtCurrency(d.val)}</p>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-400 transition-all"
                      style={{ width: `${d.pct}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-0.5">{d.pct.toFixed(1)}% das despesas totais</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Performance por mês ─────────────────────────────────────────────── */}
      {nMonths > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={15} className="text-violet-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Performance Mensal</h2>
            {melhorMes && (
              <span className="ml-auto text-[10px] text-slate-400">
                Melhor: <span className="font-semibold text-emerald-600 capitalize">{melhorMes.label}</span>
                {piorMes && piorMes.mk !== melhorMes.mk && (
                  <> · Pior: <span className="font-semibold text-rose-500 capitalize">{piorMes.label}</span></>
                )}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-slate-500 font-semibold">Mês</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold">Receita</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold">Resultado</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold">Marg. Resultado</th>
                  <th className="text-center py-2 px-3 text-slate-500 font-semibold">Tendência</th>
                </tr>
              </thead>
              <tbody>
                {monthKeys.map((mk, i) => {
                  const rec = receitaByMonth[mk] ?? 0;
                  const res = resultadoByMonth[mk] ?? 0;
                  const marg = rec > 0 ? (res / rec) * 100 : null;
                  const prevRec = i > 0 ? (receitaByMonth[monthKeys[i - 1]] ?? 0) : null;
                  const trend = prevRec !== null ? delta(rec, prevRec) : null;
                  const isBest = melhorMes?.mk === mk;
                  const isWorst = piorMes?.mk === mk && piorMes.mk !== melhorMes?.mk;

                  return (
                    <tr key={mk} className={`border-b border-slate-50 ${isBest ? 'bg-emerald-50/50' : isWorst ? 'bg-rose-50/50' : ''}`}>
                      <td className="py-2 px-3 font-medium text-slate-700 capitalize">
                        <span className="flex items-center gap-1.5">
                          {isBest && <span className="text-[8px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">MELHOR</span>}
                          {isWorst && <span className="text-[8px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded-full">PIOR</span>}
                          {monthLabels[i]}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">{rec > 0 ? fmtCurrency(rec) : <span className="text-slate-300">—</span>}</td>
                      <td className={`py-2 px-3 text-right font-semibold ${res > 0 ? 'text-emerald-600' : res < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {rec > 0 ? fmtCurrency(res) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {marg !== null && rec > 0 ? (
                          <span className={`font-bold ${marg > 5 ? 'text-emerald-600' : marg > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {fmtPct(marg)}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="flex items-center justify-center gap-1 text-[10px]">
                          <TrendIcon v={trend} />
                          {trend !== null ? (
                            <span className={Math.abs(trend) < 2 ? 'text-slate-400' : trend > 0 ? 'text-emerald-600' : 'text-rose-500'}>
                              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Perguntas para reflexão ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-5">
          <Brain size={16} className="text-violet-400" />
          <h2 className="text-sm font-bold uppercase tracking-wide opacity-80">5 Perguntas para Você Refletir</h2>
          <span className="ml-auto text-[10px] opacity-30">baseado nos dados do período</span>
        </div>
        <div className="space-y-3">
          {questions.map((item, i) => (
            <div key={i} className="flex items-start gap-3 group">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm text-white/80 leading-relaxed">{item.q}</p>
              </div>
              <span className="text-[9px] font-bold bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full shrink-0 mt-1">{item.tag}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Meses analisados', val: nMonths },
            { label: 'Meses positivos', val: mesesPos, color: 'text-emerald-400' },
            { label: 'Meses negativos', val: mesesNeg, color: mesesNeg > 0 ? 'text-rose-400' : 'text-slate-400' },
            { label: 'Lançamentos', val: saidas.length + entradas.length },
          ].map((m) => (
            <div key={m.label}>
              <p className={`text-2xl font-black ${m.color ?? 'text-white'}`}>{m.val}</p>
              <p className="text-[10px] opacity-40 uppercase tracking-wider mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
