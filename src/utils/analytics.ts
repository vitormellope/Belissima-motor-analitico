import type { Transaction, NaturezaTotal, TimeSeriesPoint, PeriodType } from '../types';
import {
  format,
  startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear,
  endOfDay, endOfWeek, endOfMonth, endOfQuarter, endOfYear,
  subMonths, subQuarters, subYears, subWeeks, subDays,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval,
  differenceInDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Period Bounds ────────────────────────────────────────────────────────────

export function filterByPeriod(txs: Transaction[], start: Date, end: Date): Transaction[] {
  return txs.filter((t) => t.data >= startOfDay(start) && t.data <= endOfDay(end));
}

export function getPeriodBounds(type: PeriodType, refDate: Date = new Date()) {
  switch (type) {
    case 'dia':      return { start: startOfDay(refDate),      end: endOfDay(refDate) };
    case 'semana':   return { start: startOfWeek(refDate, { locale: ptBR }), end: endOfWeek(refDate, { locale: ptBR }) };
    case 'mes':      return { start: startOfMonth(refDate),    end: endOfMonth(refDate) };
    case 'trimestre':return { start: startOfQuarter(refDate),  end: endOfQuarter(refDate) };
    case 'ano':      return { start: startOfYear(refDate),     end: endOfYear(refDate) };
  }
}

export function getPreviousPeriodBounds(type: PeriodType, refDate: Date = new Date()) {
  switch (type) {
    case 'dia':      return getPeriodBounds('dia',      subDays(refDate, 1));
    case 'semana':   return getPeriodBounds('semana',   subWeeks(refDate, 1));
    case 'mes':      return getPeriodBounds('mes',      subMonths(refDate, 1));
    case 'trimestre':return getPeriodBounds('trimestre',subQuarters(refDate, 1));
    case 'ano':      return getPeriodBounds('ano',      subYears(refDate, 1));
  }
}

// Granularity for the temporal chart based on selected period
export function chartGranularity(pt: PeriodType): PeriodType {
  if (pt === 'ano')      return 'mes';
  if (pt === 'trimestre')return 'semana';
  return 'dia';
}

// Auto-detect granularity for custom date ranges
export function autoGranularity(start: Date, end: Date): PeriodType {
  const days = differenceInDays(end, start);
  if (days <= 31)  return 'dia';
  if (days <= 120) return 'semana';
  if (days <= 730) return 'mes';
  return 'trimestre';
}

// ─── Aggregations ─────────────────────────────────────────────────────────────

export function sumRealizado(txs: Transaction[]): number {
  return txs.reduce((acc, t) => acc + t.vRealizado, 0);
}

export function getNaturezaTotals(txs: Transaction[]): NaturezaTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txs) {
    const cur = map.get(t.natureza) ?? { total: 0, count: 0 };
    map.set(t.natureza, { total: cur.total + t.vRealizado, count: cur.count + 1 });
  }
  const grand = txs.reduce((a, t) => a + t.vRealizado, 0);
  return Array.from(map.entries())
    .map(([natureza, { total, count }]) => ({
      natureza, total, count,
      percentual: grand > 0 ? (total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface NaturezaComparativo extends NaturezaTotal {
  previousTotal: number;
  variation: number;
}

export function getNaturezaComparativo(
  current: Transaction[],
  previous: Transaction[]
): NaturezaComparativo[] {
  const cur = getNaturezaTotals(current);
  const prev = getNaturezaTotals(previous);
  const prevMap = new Map(prev.map((n) => [n.natureza, n.total]));

  return cur.map((n) => {
    const prevTotal = prevMap.get(n.natureza) ?? 0;
    return {
      ...n,
      previousTotal: prevTotal,
      variation: calcVariation(n.total, prevTotal),
    };
  });
}

export function getContaTotals(txs: Transaction[]) {
  const map = new Map<string, number>();
  for (const t of txs) {
    map.set(t.conta, (map.get(t.conta) ?? 0) + t.vRealizado);
  }
  return Array.from(map.entries())
    .map(([conta, total]) => ({ conta, total }))
    .sort((a, b) => b.total - a.total);
}

export function getTopFornecedores(txs: Transaction[], n = 10) {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txs) {
    if (!t.fornecedor) continue;
    const cur = map.get(t.fornecedor) ?? { total: 0, count: 0 };
    map.set(t.fornecedor, { total: cur.total + t.vRealizado, count: cur.count + 1 });
  }
  return Array.from(map.entries())
    .map(([fornecedor, { total, count }]) => ({ fornecedor, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

// ─── Day-of-week analysis ─────────────────────────────────────────────────────

export function getDayOfWeekTotals(txs: Transaction[]) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const map = new Map<number, { total: number; count: number }>();
  for (let d = 0; d < 7; d++) map.set(d, { total: 0, count: 0 });
  for (const t of txs) {
    const dow = t.data.getDay();
    const cur = map.get(dow)!;
    map.set(dow, { total: cur.total + t.vRealizado, count: cur.count + 1 });
  }
  return days.map((name, idx) => ({ name, ...map.get(idx)! }));
}

// ─── Time Series ─────────────────────────────────────────────────────────────

function periodKey(date: Date, gran: PeriodType): string {
  switch (gran) {
    case 'dia':       return format(date, 'dd/MM', { locale: ptBR });
    case 'semana':    return `Sem ${format(date, 'w', { locale: ptBR })}`;
    case 'mes':       return format(date, "MMM/yy", { locale: ptBR });
    case 'trimestre': return `T${Math.ceil((date.getMonth() + 1) / 3)}/${format(date, 'yy')}`;
    case 'ano':       return format(date, 'yyyy');
  }
}

export function buildTimeSeries(
  saidas: Transaction[],
  entradas: Transaction[],
  granularity: PeriodType,
  start: Date,
  end: Date
): TimeSeriesPoint[] {
  let intervals: Date[];
  switch (granularity) {
    case 'dia':       intervals = eachDayOfInterval({ start, end }); break;
    case 'semana':    intervals = eachWeekOfInterval({ start, end }, { locale: ptBR }); break;
    case 'mes':       intervals = eachMonthOfInterval({ start, end }); break;
    case 'trimestre': intervals = eachQuarterOfInterval({ start, end }); break;
    case 'ano':       intervals = [startOfYear(start)]; break;
  }

  return intervals.map((intervalStart) => {
    let intervalEnd: Date;
    switch (granularity) {
      case 'dia':       intervalEnd = endOfDay(intervalStart); break;
      case 'semana':    intervalEnd = endOfWeek(intervalStart, { locale: ptBR }); break;
      case 'mes':       intervalEnd = endOfMonth(intervalStart); break;
      case 'trimestre': intervalEnd = endOfQuarter(intervalStart); break;
      case 'ano':       intervalEnd = endOfYear(intervalStart); break;
    }

    const s = filterByPeriod(saidas, intervalStart, intervalEnd);
    const e = filterByPeriod(entradas, intervalStart, intervalEnd);
    const sTotal = sumRealizado(s);
    const eTotal = sumRealizado(e);

    return {
      period: periodKey(intervalStart, granularity),
      saidas: sTotal,
      entradas: eTotal,
      saldo: eTotal - sTotal,
    };
  });
}

// ─── Comparison Series (two overlapping periods on same chart) ────────────────

export interface ComparisonPoint {
  label: string;
  periodo1: number;
  periodo2: number;
}

export function buildComparisonSeries(
  txs1: Transaction[],
  txs2: Transaction[],
  granularity: PeriodType,
  start1: Date, end1: Date,
  start2: Date, end2: Date
): ComparisonPoint[] {
  const s1 = buildTimeSeries(txs1, [], granularity, start1, end1);
  const s2 = buildTimeSeries(txs2, [], granularity, start2, end2);
  const len = Math.max(s1.length, s2.length);
  return Array.from({ length: len }, (_, i) => ({
    label: s1[i]?.period ?? s2[i]?.period ?? String(i + 1),
    periodo1: s1[i]?.saidas ?? 0,
    periodo2: s2[i]?.saidas ?? 0,
  }));
}

// ─── Natureza Monthly Matrix (for Radar de Variação) ─────────────────────────

export interface MonthlyCell {
  monthKey: string;   // '2026-01'
  monthLabel: string; // 'Jan/26'
  total: number;
  variation: number | null; // null = first month (no previous to compare)
  isNew: boolean;           // true = natureza started this month
}

export interface NaturezaMatrixRow {
  natureza: string;
  totalGeral: number;
  avgMonthly: number;
  cells: MonthlyCell[];
}

export function buildNaturezaMatrix(txs: Transaction[]): {
  rows: NaturezaMatrixRow[];
  monthKeys: string[];
  monthLabels: string[];
} {
  // Collect all month keys
  const monthsSet = new Set<string>();
  for (const t of txs) {
    if (!t.data) continue;
    monthsSet.add(
      `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}`
    );
  }
  const monthKeys = Array.from(monthsSet).sort();
  const monthLabels = monthKeys.map((k) => {
    const [y, m] = k.split('-');
    return format(new Date(+y, +m - 1, 1), "MMM/yy", { locale: ptBR });
  });

  // Totals per (natureza, month)
  const totals = new Map<string, Map<string, number>>();
  for (const t of txs) {
    if (!t.data) continue;
    const mk = `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}`;
    if (!totals.has(t.natureza)) totals.set(t.natureza, new Map());
    const nm = totals.get(t.natureza)!;
    nm.set(mk, (nm.get(mk) ?? 0) + t.vRealizado);
  }

  const rows: NaturezaMatrixRow[] = Array.from(totals.entries()).map(([natureza, nm]) => {
    const totalGeral = Array.from(nm.values()).reduce((a, b) => a + b, 0);
    const monthsWithData = nm.size;
    const cells: MonthlyCell[] = monthKeys.map((mk, idx) => {
      const total = nm.get(mk) ?? 0;
      const prevMk = monthKeys[idx - 1];
      const prevTotal = prevMk !== undefined ? (nm.get(prevMk) ?? 0) : null;
      let variation: number | null = null;
      let isNew = false;
      if (prevTotal !== null) {
        if (prevTotal === 0 && total > 0) {
          isNew = true; // new expense category this month
          variation = null;
        } else if (prevTotal > 0) {
          variation = ((total - prevTotal) / prevTotal) * 100;
        } else {
          variation = 0;
        }
      }
      return { monthKey: mk, monthLabel: monthLabels[idx], total, variation, isNew };
    });
    return { natureza, totalGeral, avgMonthly: totalGeral / Math.max(monthsWithData, 1), cells };
  });

  return {
    rows: rows.sort((a, b) => b.totalGeral - a.totalGeral),
    monthKeys,
    monthLabels,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calcVariation(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
  }).format(value);
}

export function fmtPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}
