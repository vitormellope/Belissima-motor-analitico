import { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import type { PaymentMethodSummary } from '../types';
import { fmtCurrency } from '../utils/analytics';
import { KPICard } from '../components/KPICard';
import { InfoTooltip } from '../components/InfoTooltip';
import { CreditCard, Users, Receipt, Trophy, X } from 'lucide-react';

interface Props {
  paymentSummary: PaymentMethodSummary[];
}

const METODO_COLORS: Record<string, string> = {
  CREDITO: '#a78bfa',
  DEBITO: '#60a5fa',
  DINHEIRO: '#34d399',
  PIX: '#fbbf24',
  SENFF: '#f472b6',
};

// Rótulo amigável para exibição (o dado bruto vem em caixa alta)
const METODO_LABEL: Record<string, string> = {
  CREDITO: 'Crédito',
  DEBITO: 'Débito',
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  SENFF: 'Senff',
};

function grupoBase(forma: string): string {
  const f = forma.toUpperCase();
  if (f.startsWith('CREDITO')) return 'CREDITO';
  if (f.startsWith('DEBITO')) return 'DEBITO';
  if (f.startsWith('DINHEIRO')) return 'DINHEIRO';
  if (f.startsWith('PIX')) return 'PIX';
  if (f.startsWith('SENFF')) return 'SENFF';
  return f;
}

function label(grupo: string): string {
  return METODO_LABEL[grupo] ?? grupo;
}

function SectionTitle({ icon, title, tooltip }: { icon: React.ReactNode; title: string; tooltip?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-rose-500">{icon}</span>
      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
  );
}

// ─── Modal: detalhamento das formas que compõem um grupo ────────────────────────
function GrupoModal({
  grupo, rows, totalValor, onClose,
}: {
  grupo: string;
  rows: PaymentMethodSummary[];
  totalValor: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const grupoTotal = rows.reduce((s, r) => s + r.valor, 0);
  const grupoAtend = rows.reduce((s, r) => s + r.atendimentos, 0);
  const sorted = [...rows].sort((a, b) => b.valor - a.valor);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between p-5 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border"
                style={{ background: `${METODO_COLORS[grupo] ?? '#94a3b8'}22`, color: METODO_COLORS[grupo] ?? '#64748b', borderColor: `${METODO_COLORS[grupo] ?? '#94a3b8'}55` }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: METODO_COLORS[grupo] ?? '#94a3b8' }} />
                FORMA DE PAGAMENTO
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-800">{label(grupo)}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {rows.length} {rows.length === 1 ? 'variação' : 'variações'} · {grupoAtend.toLocaleString('pt-BR')} atendimentos · {totalValor > 0 ? ((grupoTotal / totalValor) * 100).toFixed(1) : '0'}% do total
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-3 text-slate-500 font-semibold">Forma</th>
                <th className="text-right py-2 px-3 text-slate-500 font-semibold">Ticket Médio</th>
                <th className="text-right py-2 px-3 text-slate-500 font-semibold">Atendimentos</th>
                <th className="text-right py-2 px-3 text-slate-500 font-semibold">TEF</th>
                <th className="text-right py-2 px-3 text-slate-500 font-semibold">POS</th>
                <th className="text-right py-2 px-3 text-slate-500 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => (
                <tr key={idx} className={`border-b border-slate-50 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                  <td className="py-2 px-3 text-slate-700 font-medium">{r.formaPagamento}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{fmtCurrency(r.ticketMedio)}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{r.atendimentos.toLocaleString('pt-BR')}</td>
                  <td className="py-2 px-3 text-right text-slate-500">{r.tef !== null ? fmtCurrency(r.tef) : '—'}</td>
                  <td className="py-2 px-3 text-right text-slate-500">{r.pos !== null ? fmtCurrency(r.pos) : '—'}</td>
                  <td className="py-2 px-3 text-right text-slate-800 font-semibold">{fmtCurrency(r.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200">
                <td className="py-2 px-3 font-bold text-slate-800">Total {label(grupo)}</td>
                <td className="py-2 px-3" />
                <td className="py-2 px-3 text-right font-bold text-slate-700">{grupoAtend.toLocaleString('pt-BR')}</td>
                <td className="py-2 px-3" />
                <td className="py-2 px-3" />
                <td className="py-2 px-3 text-right font-bold text-slate-900">{fmtCurrency(grupoTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ResumoVendasPage({ paymentSummary }: Props) {
  const [modalGrupo, setModalGrupo] = useState<string | null>(null);

  const {
    totalValor, totalAtendimentos, ticketMedioGeral, formaMaisUsada, porGrupo,
  } = useMemo(() => {
    const totalValor = paymentSummary.reduce((s, p) => s + p.valor, 0);
    const totalAtendimentos = paymentSummary.reduce((s, p) => s + p.atendimentos, 0);
    const ticketMedioGeral = totalAtendimentos > 0 ? totalValor / totalAtendimentos : 0;

    const grupos = new Map<string, { valor: number; atendimentos: number }>();
    for (const p of paymentSummary) {
      const g = grupoBase(p.formaPagamento);
      const atual = grupos.get(g) ?? { valor: 0, atendimentos: 0 };
      grupos.set(g, { valor: atual.valor + p.valor, atendimentos: atual.atendimentos + p.atendimentos });
    }
    const porGrupo = Array.from(grupos.entries())
      .map(([grupo, v]) => ({
        grupo,
        valor: v.valor,
        atendimentos: v.atendimentos,
        percentual: totalValor > 0 ? (v.valor / totalValor) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // Forma mais usada = maior GRUPO por valor (crédito somado, não a linha isolada)
    const formaMaisUsada = porGrupo[0] ?? null;

    return { totalValor, totalAtendimentos, ticketMedioGeral, formaMaisUsada, porGrupo };
  }, [paymentSummary]);

  if (paymentSummary.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <p className="text-sm text-slate-500">Nenhum dado de formas de pagamento importado ainda.</p>
      </div>
    );
  }

  const modalRows = modalGrupo
    ? paymentSummary.filter((p) => grupoBase(p.formaPagamento) === modalGrupo)
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Resumo de Vendas</h1>
        <p className="text-xs text-slate-400 mt-0.5">Proporção de entrada por forma de pagamento — cartão, PIX, dinheiro etc.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total de Entradas"
          value={totalValor}
          format="currency"
          icon={<CreditCard size={16} />}
          accent="text-emerald-600"
          tooltip="Soma do valor recebido em todas as formas de pagamento do período importado (TEF + POS + dinheiro/PIX)."
        />
        <KPICard
          label="Atendimentos"
          value={totalAtendimentos}
          format="number"
          icon={<Users size={16} />}
          accent="text-slate-700"
          tooltip="Quantidade total de vendas registradas, somando todas as formas de pagamento."
        />
        <KPICard
          label="Ticket Médio Geral"
          value={ticketMedioGeral}
          format="currency"
          icon={<Receipt size={16} />}
          accent="text-violet-600"
          tooltip="Total de entradas dividido pelo total de atendimentos. Mostra o valor médio gasto por venda, independente da forma de pagamento."
        />
        <KPICard
          label="Forma Mais Usada"
          value={0}
          format="number"
          icon={<Trophy size={16} />}
          accent="text-amber-600"
          display={formaMaisUsada ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-amber-600 leading-none">{label(formaMaisUsada.grupo)}</span>
              <span className="text-lg font-bold text-slate-400 leading-none">{formaMaisUsada.percentual.toFixed(1)}%</span>
            </div>
          ) : <span className="text-2xl font-bold text-amber-600">—</span>}
          tooltip={formaMaisUsada
            ? `${label(formaMaisUsada.grupo)} é a forma de pagamento com maior volume: ${fmtCurrency(formaMaisUsada.valor)} (${formaMaisUsada.percentual.toFixed(1)}% do total). Considera todas as variações do tipo somadas (ex.: crédito 1x a 6x).`
            : 'Sem dados.'}
        />
      </div>

      {/* Gráfico por grupo de forma de pagamento */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <SectionTitle
          icon={<CreditCard size={16} />}
          title="Entrada por Tipo de Pagamento"
          tooltip="Formas de pagamento agrupadas por tipo (ex: todas as parcelas de crédito somadas em 'Crédito'). O valor de cada barra é a soma da entrada daquele tipo; o percentual é a fatia sobre o total geral. Clique numa barra para ver as variações que a compõem."
        />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={porGrupo}
            layout="vertical"
            margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
            onClick={(data: unknown) => {
              const d = data as { activePayload?: { payload?: { grupo?: string } }[] } | null;
              const g = d?.activePayload?.[0]?.payload?.grupo;
              if (g) setModalGrupo(g);
            }}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tickFormatter={(v) => fmtCurrency(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis type="category" dataKey="grupo" width={90} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} tickFormatter={(v: unknown) => label(String(v))} />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[180px]">
                    <p className="font-semibold text-slate-700 mb-1.5">{label(payload[0].payload.grupo)}</p>
                    <p className="text-slate-500">Entrada: <span className="font-bold text-slate-800">{fmtCurrency(payload[0].payload.valor)}</span></p>
                    <p className="text-slate-500">Atendimentos: <span className="font-bold text-slate-800">{payload[0].payload.atendimentos.toLocaleString('pt-BR')}</span></p>
                    <p className="text-slate-500">Fatia: <span className="font-bold text-slate-800">{payload[0].payload.percentual.toFixed(1)}%</span></p>
                    <p className="text-[10px] text-slate-400 mt-1 italic">Clique para ver as variações</p>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
              {porGrupo.map((entry, idx) => (
                <Cell key={idx} fill={METODO_COLORS[entry.grupo] ?? '#94a3b8'} />
              ))}
              <LabelList
                dataKey="percentual"
                position="right"
                formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
                style={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela detalhada — dado bruto, sem agrupamento */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <SectionTitle
          icon={<Receipt size={16} />}
          title="Detalhamento por Forma de Pagamento"
          tooltip="Linha a linha, exatamente como consta no Resumo de Vendas importado. TEF e POS mostram o valor processado em cada maquininha; '—' significa que a forma de pagamento não passa por maquininha (ex: dinheiro, PIX direto)."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2.5 px-3 text-slate-500 font-semibold">Forma de Pagamento</th>
                <th className="text-right py-2.5 px-3 text-slate-500 font-semibold">Ticket Médio</th>
                <th className="text-right py-2.5 px-3 text-slate-500 font-semibold">Atendimentos</th>
                <th className="text-right py-2.5 px-3 text-slate-500 font-semibold">Percentual</th>
                <th className="text-right py-2.5 px-3 text-slate-500 font-semibold">TEF</th>
                <th className="text-right py-2.5 px-3 text-slate-500 font-semibold">POS</th>
                <th className="text-right py-2.5 px-3 text-slate-500 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {[...paymentSummary].sort((a, b) => b.valor - a.valor).map((p, idx) => (
                <tr key={idx} className={`border-b border-slate-50 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                  <td className="py-2 px-3 text-slate-700 font-medium">{p.formaPagamento}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{fmtCurrency(p.ticketMedio)}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{p.atendimentos.toLocaleString('pt-BR')}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{p.percentual.toFixed(2)}%</td>
                  <td className="py-2 px-3 text-right text-slate-500">{p.tef !== null ? fmtCurrency(p.tef) : '—'}</td>
                  <td className="py-2 px-3 text-right text-slate-500">{p.pos !== null ? fmtCurrency(p.pos) : '—'}</td>
                  <td className="py-2 px-3 text-right text-slate-800 font-semibold">{fmtCurrency(p.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalGrupo && (
        <GrupoModal grupo={modalGrupo} rows={modalRows} totalValor={totalValor} onClose={() => setModalGrupo(null)} />
      )}
    </div>
  );
}
