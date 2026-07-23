import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Transaction, PaymentMethodSummary, BankBalance } from '../types';

interface BankBalanceRow {
  ref_date: string;
  mes: string;
  conta: string;
  saldo: number;
}

interface TransactionRow {
  tipo: string | null;
  empresa: string | null;
  natureza: string;
  data: string;
  v_previsto: number;
  v_realizado: number;
  conta: string | null;
  fornecedor: string | null;
  status: string | null;
  source: 'saidas' | 'entradas';
  imported_at: string;
}

interface PaymentSummaryRow {
  forma_pagamento: string;
  ticket_medio: number | null;
  atendimentos: number | null;
  percentual: number | null;
  tef: number | null;
  pos: number | null;
  valor: number;
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    tipo: row.tipo ?? '',
    empresa: row.empresa ?? '',
    natureza: row.natureza,
    // "data" vem como 'YYYY-MM-DD' — parse manual evita fuso horário deslocar o dia
    data: (() => {
      const [y, m, d] = row.data.split('-').map(Number);
      return new Date(y, m - 1, d);
    })(),
    vPrevisto: row.v_previsto,
    vRealizado: row.v_realizado,
    conta: row.conta ?? '',
    fornecedor: row.fornecedor ?? '',
    status: row.status,
    source: row.source,
  };
}

function toPaymentSummary(row: PaymentSummaryRow): PaymentMethodSummary {
  return {
    formaPagamento: row.forma_pagamento,
    ticketMedio: row.ticket_medio ?? 0,
    atendimentos: row.atendimentos ?? 0,
    percentual: row.percentual ?? 0,
    tef: row.tef,
    pos: row.pos,
    valor: row.valor,
  };
}

export function useSupabaseData() {
  const [saidas, setSaidas] = useState<Transaction[]>([]);
  const [entradas, setEntradas] = useState<Transaction[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentMethodSummary[]>([]);
  const [bankBalances, setBankBalances] = useState<BankBalance[]>([]);
  const [lastImportedAt, setLastImportedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [integrityWarning, setIntegrityWarning] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      // O Supabase limita cada select a 1000 linhas — paginar com range() garante
      // que TODAS as transações venham (senão meses inteiros somem do dashboard).
      const PAGE = 1000;
      const rows: (TransactionRow & { id: number })[] = [];
      let serverCount: number | null = null;
      for (let from = 0; ; from += PAGE) {
        const { data, error, count } = await supabase
          .from('transactions')
          .select('*', { count: from === 0 ? 'exact' : undefined })
          // "data" tem muitos valores repetidos — sem um desempate único (id),
          // o Postgres pode devolver a mesma linha em duas páginas (ou pular linhas)
          // ao paginar com range(), pois a ordenação de empates não é garantida
          // entre requisições separadas.
          .order('data', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (from === 0) serverCount = count ?? null;
        const page = (data ?? []) as (TransactionRow & { id: number })[];
        rows.push(...page);
        if (page.length < PAGE) break;
      }

      // Confere que a paginação trouxe cada linha exatamente uma vez — se algum dia
      // esse desempate falhar de novo (ou por qualquer outro motivo a paginação
      // vier inconsistente), avisa em vez de exibir números errados silenciosamente.
      const uniqueIds = new Set(rows.map((r) => r.id));
      if (uniqueIds.size !== rows.length) {
        setIntegrityWarning(
          `Paginação trouxe ${rows.length} linhas mas apenas ${uniqueIds.size} IDs únicos — há linhas duplicadas.`
        );
      } else if (serverCount !== null && serverCount !== rows.length) {
        setIntegrityWarning(
          `Tabela tem ${serverCount} linhas mas só ${rows.length} foram carregadas — dados podem estar incompletos.`
        );
      } else {
        setIntegrityWarning(undefined);
      }

      const summaryRes = await supabase.from('payment_methods_summary').select('*');
      if (summaryRes.error) throw summaryRes.error;

      // Saldos bancários (extrato). Tolerante: se a tabela ainda não existir, segue vazio.
      const balRes = await supabase.from('bank_balances').select('*').order('ref_date', { ascending: true });
      if (balRes.error) {
        console.warn('bank_balances indisponível (tabela criada?):', balRes.error.message);
        setBankBalances([]);
      } else {
        setBankBalances((balRes.data ?? []).map((r: BankBalanceRow) => ({
          refDate: r.ref_date, mes: r.mes, conta: r.conta, saldo: Number(r.saldo),
        })));
      }

      setSaidas(rows.filter((r) => r.source === 'saidas').map(toTransaction));
      setEntradas(rows.filter((r) => r.source === 'entradas').map(toTransaction));
      setPaymentSummary((summaryRes.data ?? []).map(toPaymentSummary));

      const mostRecent = rows.reduce<string | null>(
        (acc, r) => (!acc || r.imported_at > acc ? r.imported_at : acc),
        null,
      );
      setLastImportedAt(mostRecent ? new Date(mostRecent) : null);
    } catch (err) {
      console.error('Erro ao buscar dados do Supabase:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { saidas, entradas, paymentSummary, bankBalances, lastImportedAt, loading, error, integrityWarning, refresh: load };
}
