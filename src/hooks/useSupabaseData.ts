import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Transaction, PaymentMethodSummary } from '../types';

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
  const [lastImportedAt, setLastImportedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [txRes, summaryRes] = await Promise.all([
        supabase.from('transactions').select('*').order('data', { ascending: true }),
        supabase.from('payment_methods_summary').select('*'),
      ]);

      if (txRes.error) throw txRes.error;
      if (summaryRes.error) throw summaryRes.error;

      const rows = (txRes.data ?? []) as TransactionRow[];
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

  return { saidas, entradas, paymentSummary, lastImportedAt, loading, error, refresh: load };
}
