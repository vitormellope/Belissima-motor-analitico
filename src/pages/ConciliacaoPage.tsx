import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { Transaction, BankBalance } from '../types';
import { buildDRE } from '../utils/dreMapping';
import { fmtCurrency } from '../utils/analytics';
import { Scale, ChevronDown, ChevronRight, Landmark, AlertTriangle } from 'lucide-react';

interface Props {
  saidas: Transaction[];
  entradas: Transaction[];
  bankBalances: BankBalance[];
}

const OPENING = '2025-12';
const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const shortLabel = (mk: string) => {
  const [y, m] = mk.split('-');
  return `${MES_ABREV[Number(m) - 1]}/${y.slice(2)}`;
};

// Contas do extrato (nome de exibição + cor)
const CONTAS = [
  { key: 'TESOURARIA', label: 'Tesouraria', color: '#6366f1' },
  { key: 'BRADESCO', label: 'Bradesco', color: '#e11d48' },
  { key: 'ITAU', label: 'Itaú', color: '#f97316' },
];

export function ConciliacaoPage({ saidas, entradas, bankBalances }: Props) {
  const [extratoAberto, setExtratoAberto] = useState(false);

  const dre = useMemo(() => buildDRE(saidas, entradas), [saidas, entradas]);
  const hasData = saidas.length > 0 || entradas.length > 0;

  const L = (n: number) => dre.lines.find((l) => l.linha === n);
  const resultadoLine = L(17);
  const fluxoLine = L(18);

  const colKeys = [OPENING, ...dre.monthKeys];
  const colLabel = (mk: string) => shortLabel(mk);

  // Extrato por mês: soma + composição por conta
  const extratoByMonth = useMemo(() => {
    const m = new Map<string, { total: number; contas: Record<string, number> }>();
    for (const b of bankBalances) {
      if (!m.has(b.mes)) m.set(b.mes, { total: 0, contas: {} });
      const e = m.get(b.mes)!;
      e.total += b.saldo;
      e.contas[b.conta.toUpperCase()] = (e.contas[b.conta.toUpperCase()] ?? 0) + b.saldo;
    }
    return m;
  }, [bankBalances]);

  const temExtrato = bankBalances.length > 0;

  // ── Sistema (Ilimitar) ──
  const resultadoVal = (mk: string) => (mk === OPENING ? null : resultadoLine?.months[mk] ?? 0);
  const fluxoVal = (mk: string) => (mk === OPENING ? dre.saldoInicial : fluxoLine?.months[mk] ?? 0);

  // ── Extrato ──
  // Fluxo de Caixa (extrato) = saldo bancário acumulado no fim do mês
  const extratoFluxoVal = (mk: string) => extratoByMonth.get(mk)?.total;
  // Resultado do Mês (extrato) = variação do saldo bancário no mês (mês atual − mês anterior)
  const extratoResultadoVal = (mk: string): number | null | undefined => {
    if (mk === OPENING) return null;
    const idx = colKeys.indexOf(mk);
    const atual = extratoFluxoVal(mk);
    const anterior = extratoFluxoVal(colKeys[idx - 1]);
    return atual === undefined || anterior === undefined ? undefined : atual - anterior;
  };

  // ── Comparativo (Extrato − Sistema) ──
  const compResultadoVal = (mk: string): number | null | undefined => {
    if (mk === OPENING) return null;
    const er = extratoResultadoVal(mk);
    return er === undefined || er === null ? undefined : er - (resultadoVal(mk) ?? 0);
  };
  const compFluxoVal = (mk: string) => {
    const ex = extratoFluxoVal(mk);
    return ex === undefined ? undefined : ex - fluxoVal(mk);
  };

  // Dados do gráfico de proporção (meses com extrato)
  const chartData = useMemo(
    () =>
      colKeys
        .filter((mk) => extratoByMonth.has(mk))
        .map((mk) => {
          const c = extratoByMonth.get(mk)!.contas;
          return {
            mes: shortLabel(mk),
            Tesouraria: c['TESOURARIA'] ?? 0,
            Bradesco: c['BRADESCO'] ?? 0,
            Itaú: c['ITAU'] ?? 0,
          };
        }),
    [colKeys, extratoByMonth],
  );

  const cell = (v: number | null | undefined, opts: { bold?: boolean; signed?: boolean } = {}) => {
    if (v === null || v === undefined) return <span className="opacity-30">—</span>;
    const color = opts.signed ? (v > 0 ? 'text-emerald-600' : v < 0 ? 'text-rose-600' : 'text-slate-500') : '';
    return <span className={`${opts.bold ? 'font-bold' : ''} ${color}`}>{fmtCurrency(v)}</span>;
  };

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
        <Scale size={40} className="text-slate-200" />
        <p className="text-sm font-semibold text-slate-500">Sem dados para conciliar</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Conciliação</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Confronto entre o caixa do nosso sistema (Fluxo de Caixa, base PDV) e o saldo real do extrato bancário.
        </p>
      </div>

      {!temExtrato && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Os saldos do extrato ainda não foram encontrados no banco (tabela <code>bank_balances</code>). Assim que a tabela for criada e populada, esta tela preenche automaticamente.
          </p>
        </div>
      )}

      {/* Tabela de conciliação */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Scale size={15} className="text-rose-500" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Conciliação de Caixa — Sistema vs Extrato</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full" style={{ minWidth: `${360 + colKeys.length * 130}px` }}>
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                <th className="text-left py-2.5 px-4 text-slate-100 font-semibold sticky left-0 z-20 bg-slate-800 border-r border-slate-700 min-w-[240px] whitespace-nowrap">
                  Descrição
                </th>
                {colKeys.map((mk) => (
                  <th key={mk} className="text-right py-2.5 px-4 text-slate-100 font-semibold min-w-[120px] capitalize border-l border-slate-700">
                    {colLabel(mk)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* ── Subbloco 1 — Sistema (Ilimitar) ── */}
              <tr>
                <td colSpan={colKeys.length + 1} className="py-1.5 px-4 text-[10px] font-bold uppercase tracking-widest bg-sky-100 text-sky-800 border-y border-sky-200">
                  Sistema (Ilimitar)
                </td>
              </tr>
              <tr className="border-b border-slate-100/50 bg-sky-50/60">
                <td className="py-2 px-4 sticky left-0 z-10 bg-sky-50 border-r border-slate-200/50 whitespace-nowrap text-slate-700">(=) Resultado do Mês</td>
                {colKeys.map((mk) => <td key={mk} className="py-2 px-4 text-right border-l border-slate-100/30">{cell(resultadoVal(mk))}</td>)}
              </tr>
              <tr className="border-b border-slate-100/50 bg-sky-100 font-bold">
                <td className="py-2 px-4 sticky left-0 z-10 bg-sky-100 border-r border-slate-200/50 whitespace-nowrap text-slate-800">Fluxo de Caixa</td>
                {colKeys.map((mk) => <td key={mk} className="py-2 px-4 text-right border-l border-slate-100/30 text-slate-800">{cell(fluxoVal(mk), { bold: true })}</td>)}
              </tr>

              {/* ── Subbloco 2 — Extrato Bancário ── */}
              <tr>
                <td colSpan={colKeys.length + 1} className="py-1.5 px-4 text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800 border-y border-emerald-200">
                  Extrato Bancário
                </td>
              </tr>
              <tr className="border-b border-slate-100/50 bg-emerald-50/60">
                <td className="py-2 px-4 sticky left-0 z-10 bg-emerald-50 border-r border-slate-200/50 whitespace-nowrap text-slate-700">
                  (=) Resultado do Mês <span className="text-[9px] font-normal opacity-50">(variação do saldo)</span>
                </td>
                {colKeys.map((mk) => <td key={mk} className="py-2 px-4 text-right border-l border-slate-100/30">{cell(extratoResultadoVal(mk))}</td>)}
              </tr>
              <tr className="border-b border-slate-100/50 bg-emerald-100 font-bold cursor-pointer hover:brightness-95" onClick={() => setExtratoAberto((v) => !v)}>
                <td className="py-2 px-4 sticky left-0 z-10 bg-emerald-100 border-r border-slate-200/50 whitespace-nowrap text-slate-800">
                  <span className="inline-flex items-center gap-1.5">
                    {extratoAberto ? <ChevronDown size={12} className="opacity-60" /> : <ChevronRight size={12} className="opacity-50" />}
                    <Landmark size={12} className="text-emerald-600" />
                    Fluxo de Caixa <span className="text-[9px] font-normal opacity-50">(saldo — clique p/ detalhar)</span>
                  </span>
                </td>
                {colKeys.map((mk) => <td key={mk} className="py-2 px-4 text-right border-l border-slate-100/30 text-slate-800">{cell(extratoFluxoVal(mk), { bold: true })}</td>)}
              </tr>
              {extratoAberto && CONTAS.map((conta) => (
                <tr key={conta.key} className="border-b border-slate-100/30 bg-white text-slate-600">
                  <td className="py-1.5 px-4 sticky left-0 z-10 bg-white border-r border-slate-200/40 pl-10 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: conta.color }} />
                      {conta.label}
                    </span>
                  </td>
                  {colKeys.map((mk) => {
                    const c = extratoByMonth.get(mk)?.contas[conta.key];
                    return (
                      <td key={mk} className="py-1.5 px-4 text-right border-l border-slate-100/20">
                        {c === undefined ? <span className="opacity-30">—</span> : fmtCurrency(c)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* ── Subbloco 3 — Comparativo ── */}
              <tr>
                <td colSpan={colKeys.length + 1} className="py-1.5 px-4 text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-800 border-y border-amber-200">
                  Comparativo (Extrato − Sistema)
                </td>
              </tr>
              <tr className="border-b border-slate-100/50 bg-amber-50/60 font-bold">
                <td className="py-2 px-4 sticky left-0 z-10 bg-amber-50 border-r border-slate-200/50 whitespace-nowrap text-amber-900">
                  Δ Resultado do Mês <span className="text-[9px] font-normal opacity-60">(movimento não registrado)</span>
                </td>
                {colKeys.map((mk) => <td key={mk} className="py-2 px-4 text-right border-l border-slate-100/30">{cell(compResultadoVal(mk), { bold: true, signed: true })}</td>)}
              </tr>
              <tr className="border-b border-slate-100/50 bg-amber-50 font-bold">
                <td className="py-2 px-4 sticky left-0 z-10 bg-amber-50 border-r border-slate-200/50 whitespace-nowrap text-amber-900">
                  Δ Fluxo de Caixa <span className="text-[9px] font-normal opacity-60">(diferença acumulada)</span>
                </td>
                {colKeys.map((mk) => <td key={mk} className="py-2 px-4 text-right border-l border-slate-100/30">{cell(compFluxoVal(mk), { bold: true, signed: true })}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-slate-100 text-[10px] text-slate-400 bg-slate-50/50 leading-relaxed">
          <strong>Sistema (Ilimitar):</strong> Resultado do Mês = entradas − saídas do PDV; Fluxo de Caixa = saldo inicial + acúmulo desses resultados (idêntico ao DRE) ·
          <strong> Extrato Bancário:</strong> Fluxo de Caixa = saldo real do banco no fim do mês; Resultado do Mês = variação do saldo (mês atual − anterior) ·
          <strong> Comparativo:</strong> Δ Resultado do Mês = quanto entrou/saiu de caixa <em>sem passar pelo PDV</em> naquele mês (ex.: empréstimos entre lojas); Δ Fluxo de Caixa = diferença acumulada.
        </div>
      </div>

      {/* Gráfico de proporção por conta */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Landmark size={16} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Extrato — Proporção por Conta</h2>
            <span className="text-[10px] text-slate-400 ml-auto">saldo por banco no fim de cada mês</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tickFormatter={(v: number) => (v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`)}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                width={64}
              />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[180px]">
                      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
                      {payload.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                            <span className="text-slate-500">{p.name}</span>
                          </span>
                          <span className="font-bold text-slate-800">{fmtCurrency(p.value as number)}</span>
                        </div>
                      ))}
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex justify-between">
                        <span className="text-slate-400">Total</span>
                        <span className="font-bold text-slate-800">
                          {fmtCurrency(payload.reduce((s, p) => s + (p.value as number), 0))}
                        </span>
                      </div>
                    </div>
                  ) : null
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {CONTAS.map((c) => (
                <Bar key={c.key} dataKey={c.label} stackId="extrato" fill={c.color} radius={c.key === 'ITAU' ? [4, 4, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
