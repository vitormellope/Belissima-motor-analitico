import { useEffect } from 'react';
import type { Transaction } from '../types';
import { fmtCurrency } from '../utils/analytics';
import { X, TrendingDown, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  title: string;
  subtitle?: string;
  transactions: Transaction[];
  onClose: () => void;
}

export function TransactionModal({ title, subtitle, transactions, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const sorted = [...transactions].sort(
    (a, b) => b.data.getTime() - a.data.getTime()
  );

  const total = transactions.reduce((s, t) => s + t.vRealizado, 0);
  const type = transactions[0]?.source ?? 'saidas';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {type === 'saidas' ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                  SAÍDA
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  ENTRADA
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-800">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-slate-400">{sorted.length} lançamentos</p>
              <p className={`text-base font-bold ${type === 'saidas' ? 'text-rose-600' : 'text-emerald-600'}`}>
                {fmtCurrency(total)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2.5 px-4 text-slate-500 font-semibold">Data</th>
                <th className="text-left py-2.5 px-4 text-slate-500 font-semibold">Natureza</th>
                <th className="text-left py-2.5 px-4 text-slate-500 font-semibold">Fornecedor / Origem</th>
                <th className="text-left py-2.5 px-4 text-slate-500 font-semibold">Conta</th>
                <th className="text-right py-2.5 px-4 text-slate-500 font-semibold">V. Previsto</th>
                <th className="text-right py-2.5 px-4 text-slate-500 font-semibold">V. Realizado</th>
                <th className="text-right py-2.5 px-4 text-slate-500 font-semibold">Dif.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, idx) => {
                const diff = t.vRealizado - t.vPrevisto;
                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-50 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}
                  >
                    <td className="py-2 px-4 text-slate-600 whitespace-nowrap">
                      {format(t.data, 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="py-2 px-4 text-slate-700 font-medium">{t.natureza}</td>
                    <td className="py-2 px-4 text-slate-600 max-w-[160px] truncate">{t.fornecedor || '—'}</td>
                    <td className="py-2 px-4 text-slate-500 max-w-[120px] truncate">{t.conta || '—'}</td>
                    <td className="py-2 px-4 text-right text-slate-500">{fmtCurrency(t.vPrevisto)}</td>
                    <td className={`py-2 px-4 text-right font-semibold ${type === 'saidas' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {fmtCurrency(t.vRealizado)}
                    </td>
                    <td className="py-2 px-4 text-right">
                      {diff !== 0 ? (
                        <span className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${diff > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {diff > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {fmtCurrency(Math.abs(diff))}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              Nenhum lançamento encontrado para o período selecionado.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-b-2xl">
          <p className="text-[11px] text-slate-400">
            V. Realizado = valor efetivamente pago/recebido · Dif. = Realizado − Previsto
          </p>
          <button
            onClick={onClose}
            className="text-xs bg-slate-700 text-white px-4 py-1.5 rounded-xl hover:bg-slate-800 transition-colors font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
