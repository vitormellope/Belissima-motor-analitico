export interface Transaction {
  tipo: string;
  empresa: string;
  natureza: string;
  data: Date;
  vPrevisto: number;
  vRealizado: number;
  conta: string;
  fornecedor: string;
  status: string | null;
  source: 'saidas' | 'entradas';
}

export interface PaymentMethodSummary {
  formaPagamento: string;
  ticketMedio: number;
  atendimentos: number;
  percentual: number;
  tef: number | null;
  pos: number | null;
  valor: number;
}

export interface BankBalance {
  refDate: string; // YYYY-MM-DD (data do saldo)
  mes: string;     // YYYY-MM (para bucketing por mês)
  conta: string;   // TESOURARIA | BRADESCO | ITAU
  saldo: number;
}

export type PeriodType = 'dia' | 'semana' | 'mes' | 'trimestre' | 'ano';

export type PeriodMode = 'preset' | 'custom';

export interface CustomPeriod {
  start: string;
  end: string;
}

export interface NaturezaTotal {
  natureza: string;
  total: number;
  count: number;
  percentual: number;
}

export interface TimeSeriesPoint {
  period: string;
  saidas: number;
  entradas: number;
  saldo: number;
}

export interface SeasonalEvent {
  name: string;
  date: string;
  daysUntil: number;
  impact: 'muito-alto' | 'alto' | 'médio' | 'baixo';
  tip: string;
  category: 'feriado' | 'varejo' | 'temporada';
}
