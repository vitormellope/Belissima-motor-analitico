export interface Transaction {
  numero: number;
  tipo: string;
  empresa: string;
  natureza: string;
  data: Date;
  vPrevisto: number;
  vRealizado: number;
  conta: string;
  fornecedor: string;
  source: 'saidas' | 'entradas';
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
