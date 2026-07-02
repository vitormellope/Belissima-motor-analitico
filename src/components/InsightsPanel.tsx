import type { Transaction, SeasonalEvent } from '../types';
import {
  sumRealizado, filterByPeriod, calcVariation, fmtCurrency,
  getNaturezaTotals, getDayOfWeekTotals,
} from '../utils/analytics';
import { DRE_MAPEAMENTO } from '../utils/dreMapping';
import { startOfMonth, endOfMonth, subMonths, differenceInDays } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Lightbulb, AlertTriangle, TrendingUp, TrendingDown, Star,
  Calendar, ShoppingBag, Zap, Award, BarChart2, Users,
} from 'lucide-react';

// ─── Info Tooltip ─────────────────────────────────────────────────────────────

function InfoTooltip({ content }: { content: string }) {
  return (
    <span className="relative group inline-flex align-middle">
      <span className="cursor-help text-current opacity-40 hover:opacity-70 text-[10px] font-normal ml-0.5 select-none">ⓘ</span>
      <span className="pointer-events-none absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover:block w-64 bg-slate-800 text-white text-[10px] rounded-lg px-3 py-2 leading-relaxed shadow-xl whitespace-pre-line">
        {content}
      </span>
    </span>
  );
}

// ─── Seasonal calendar ────────────────────────────────────────────────────────

function getSeasonalEvents(refDate: Date): SeasonalEvent[] {
  const year = refDate.getFullYear();
  type RawEvent = { name: string; rawDate: Date; impact: SeasonalEvent['impact']; tip: string; category: SeasonalEvent['category'] };
  const events: RawEvent[] = [
    { name: 'Liquidação de Janeiro', rawDate: new Date(year, 0, 5), impact: 'alto', tip: 'Liquidações pós-natal movimentam muito o varejo de moda. Prepare descontos agressivos e vitrine renovada.', category: 'temporada' },
    { name: 'Carnaval', rawDate: new Date(year, 1, 28), impact: 'alto', tip: 'Fantasias, blusas regatas, peças coloridas e beachwear vendem muito antes do Carnaval.', category: 'feriado' },
    { name: 'Dia Internacional da Mulher', rawDate: new Date(year, 2, 8), impact: 'médio', tip: 'Ótima oportunidade para promoções de moda feminina e campanha nas redes sociais.', category: 'varejo' },
    { name: 'Dia das Mães', rawDate: new Date(year, 4, 11), impact: 'muito-alto', tip: 'Segunda maior data do varejo de moda. Prepare estoque reforçado, embalagem presente e campanha 2 semanas antes.', category: 'varejo' },
    { name: 'Dia dos Namorados', rawDate: new Date(year, 5, 12), impact: 'alto', tip: 'Looks especiais para sair, presentes e kits namorados são os mais vendidos. Invista em vitrine temática.', category: 'varejo' },
    { name: 'Liquidação de Inverno', rawDate: new Date(year, 6, 1), impact: 'alto', tip: 'Liquidação de inverno é essencial para girar o estoque e abrir espaço para coleção de primavera.', category: 'temporada' },
    { name: 'Dia dos Pais', rawDate: new Date(year, 7, 10), impact: 'alto', tip: 'Camisas, calças, bermudas e kits presentes são os mais procurados. Crie kits curados.', category: 'varejo' },
    { name: 'Dia das Crianças', rawDate: new Date(year, 9, 12), impact: 'alto', tip: 'Moda infantil e juvenil em destaque. Prepare uma área temática na loja.', category: 'varejo' },
    { name: 'Black Friday', rawDate: new Date(year, 10, 28), impact: 'muito-alto', tip: 'Maior evento de descontos do ano. Planeje ofertas com antecedência, prepare equipe e estoque robusto.', category: 'varejo' },
    { name: 'Natal', rawDate: new Date(year, 11, 25), impact: 'muito-alto', tip: 'Maior mês do varejo. Decoração de loja, embalagem presente, horário estendido e estoque adequado são essenciais.', category: 'feriado' },
    { name: 'Volta às Aulas', rawDate: new Date(year, 1, 1), impact: 'médio', tip: 'Peças casuais e uniformes escolares têm alta demanda em fevereiro.', category: 'temporada' },
    { name: 'Virada de Coleção (Verão)', rawDate: new Date(year, 8, 22), impact: 'médio', tip: 'Chegada da primavera/verão. Renove a vitrine com a nova coleção e comunique o lançamento.', category: 'temporada' },
  ];

  return events
    .map((ev) => {
      const daysUntil = differenceInDays(ev.rawDate, refDate);
      return { ...ev, date: format(ev.rawDate, "d 'de' MMM", { locale: ptBR }), daysUntil };
    })
    .filter((ev) => ev.daysUntil >= -7 && ev.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// ─── Insight generation ───────────────────────────────────────────────────────

interface Insight {
  id: string;
  type: 'warning' | 'success' | 'info' | 'danger' | 'tip';
  icon: React.ReactNode;
  title: string;
  description: string;
  value?: string;
  formula?: string;
}

function generateInsights(
  saidas: Transaction[],
  entradas: Transaction[],
  saidasCur: Transaction[],
  entradasCur: Transaction[],
  refDate: Date
): Insight[] {
  const insights: Insight[] = [];

  const curSaidasTotal   = sumRealizado(saidasCur);
  const curEntradasTotal = sumRealizado(entradasCur);

  // Previous calendar month baseline
  const prevStart = startOfMonth(subMonths(refDate, 1));
  const prevEnd   = endOfMonth(subMonths(refDate, 1));
  const prevSaidasTotal   = sumRealizado(filterByPeriod(saidas,   prevStart, prevEnd));
  const prevEntradasTotal = sumRealizado(filterByPeriod(entradas, prevStart, prevEnd));

  // ── DRE category filters ────────────────────────────────────────────────────
  const dreMap = new Map(DRE_MAPEAMENTO.map((i) => [i.natureza.toUpperCase().trim(), i]));

  const filterCur = (cat: string, subExclude?: string) =>
    saidasCur.filter((t) => {
      const item = dreMap.get(t.natureza.toUpperCase().trim());
      if (!item || item.categoria !== cat) return false;
      if (subExclude && item.subcategoria === subExclude) return false;
      return true;
    });

  const cmvTotal     = sumRealizado(filterCur('CUSTO'));
  const opexTotal    = sumRealizado(filterCur('DESPESA_OPERACIONAL', 'Deducoes de venda'));
  const sgaTotal     = sumRealizado(filterCur('DESPESA_ADMINISTRATIVA', 'Dividendos/Socios'));
  const pessoalTotal = sumRealizado(saidasCur.filter((t) => {
    const item = dreMap.get(t.natureza.toUpperCase().trim());
    return item?.categoria === 'DESPESA_OPERACIONAL' &&
           (item.subcategoria.includes('Pessoal') || item.subcategoria === 'Encargos' || item.subcategoria === 'Beneficios');
  }));
  const tributosTotal = sumRealizado(filterCur('FINANCEIRO'));

  // ── DRE Insight 1: Margem Bruta ──────────────────────────────────────────
  if (curEntradasTotal > 0 && cmvTotal > 0) {
    const grossMargin = ((curEntradasTotal - cmvTotal) / curEntradasTotal) * 100;
    const lucroBruto = curEntradasTotal - cmvTotal;
    insights.push({
      id: 'margem-bruta',
      type: grossMargin > 45 ? 'success' : grossMargin > 25 ? 'warning' : 'danger',
      icon: <TrendingUp size={14} />,
      title: `Margem Bruta: ${grossMargin.toFixed(1)}% da entrada`,
      description: `Entrada (${fmtCurrency(curEntradasTotal)}) − CMV (${fmtCurrency(cmvTotal)}) = Lucro Bruto de ${fmtCurrency(lucroBruto)}.`,
      value: `${grossMargin.toFixed(1)}% margem bruta`,
      formula: `Fórmula: (Entrada − CMV) ÷ Entrada × 100\n= (${fmtCurrency(curEntradasTotal)} − ${fmtCurrency(cmvTotal)}) ÷ ${fmtCurrency(curEntradasTotal)} × 100\n= ${grossMargin.toFixed(1)}% da entrada bruta`,
    });
  }

  // ── DRE Insight 2: Custo de Pessoal ─────────────────────────────────────
  if (curEntradasTotal > 0 && pessoalTotal > 0) {
    const pessoalPct = (pessoalTotal / curEntradasTotal) * 100;
    insights.push({
      id: 'custo-pessoal',
      type: pessoalPct > 35 ? 'warning' : 'info',
      icon: <Users size={14} />,
      title: `Saída com Pessoal: ${pessoalPct.toFixed(1)}% da entrada`,
      description: `Salários, encargos e benefícios (${fmtCurrency(pessoalTotal)}) representam ${pessoalPct.toFixed(1)}% da entrada do período.`,
      value: `${pessoalPct.toFixed(1)}% da entrada`,
      formula: `Fórmula: Saída Pessoal ÷ Entrada × 100\n= ${fmtCurrency(pessoalTotal)} ÷ ${fmtCurrency(curEntradasTotal)} × 100\n= ${pessoalPct.toFixed(1)}% da entrada bruta`,
    });
  }

  // ── DRE Insight 3: OPEX vs SGA ───────────────────────────────────────────
  if (opexTotal > 0 && sgaTotal > 0) {
    const totalClass = opexTotal + sgaTotal;
    const opexPct = (opexTotal / totalClass) * 100;
    const sgaPct  = (sgaTotal  / totalClass) * 100;
    insights.push({
      id: 'opex-vs-sga',
      type: 'info',
      icon: <BarChart2 size={14} />,
      title: 'Estrutura de Saídas',
      description: `OPEX: ${fmtCurrency(opexTotal)} (${opexPct.toFixed(0)}% das saídas classificadas) · SG&A: ${fmtCurrency(sgaTotal)} (${sgaPct.toFixed(0)}%).`,
      value: `OPEX ${opexPct.toFixed(0)}% / SGA ${sgaPct.toFixed(0)}%`,
      formula: `Fórmula: Categoria ÷ (OPEX + SG&A) × 100\nOPEX: ${fmtCurrency(opexTotal)} ÷ ${fmtCurrency(totalClass)} × 100 = ${opexPct.toFixed(1)}%\nSG&A: ${fmtCurrency(sgaTotal)} ÷ ${fmtCurrency(totalClass)} × 100 = ${sgaPct.toFixed(1)}%`,
    });
  }

  // ── DRE Insight 4: Carga Tributária ─────────────────────────────────────
  if (curEntradasTotal > 0 && tributosTotal > 0) {
    const tribPct = (tributosTotal / curEntradasTotal) * 100;
    insights.push({
      id: 'carga-tributaria',
      type: tribPct > 12 ? 'warning' : 'info',
      icon: <AlertTriangle size={14} />,
      title: `Carga Tributária: ${tribPct.toFixed(1)}% da entrada`,
      description: `Impostos e saídas financeiras (${fmtCurrency(tributosTotal)}) representam ${tribPct.toFixed(1)}% da entrada bruta do período.`,
      value: `${tribPct.toFixed(1)}% da entrada`,
      formula: `Fórmula: Tributos ÷ Entrada × 100\n= ${fmtCurrency(tributosTotal)} ÷ ${fmtCurrency(curEntradasTotal)} × 100\n= ${tribPct.toFixed(1)}% da entrada bruta`,
    });
  }

  // ── Multi-month detection: skip MoM comparisons when period spans >45 days ──
  const allDates = [...saidasCur, ...entradasCur].map((t) => t.data).filter(Boolean) as Date[];
  const isMultiMonth = allDates.length > 1 &&
    differenceInDays(
      new Date(Math.max(...allDates.map((d) => d.getTime()))),
      new Date(Math.min(...allDates.map((d) => d.getTime()))),
    ) > 45;

  // ── Cash Flow ────────────────────────────────────────────────────────────
  const varSaidas   = calcVariation(curSaidasTotal,   prevSaidasTotal);
  const varEntradas = calcVariation(curEntradasTotal, prevEntradasTotal);

  if (!isMultiMonth) {
    if (prevSaidasTotal > 0 && varSaidas > 20) {
      insights.push({
        id: 'saidas-alta',
        type: 'warning',
        icon: <AlertTriangle size={14} />,
        title: 'Gastos acima do mês anterior',
        description: `Saídas do período (${fmtCurrency(curSaidasTotal)}) cresceram ${varSaidas.toFixed(0)}% vs mês anterior (${fmtCurrency(prevSaidasTotal)}).`,
        value: `+${varSaidas.toFixed(0)}% saídas`,
        formula: `Fórmula: (Atual − Anterior) ÷ Anterior × 100\n= (${fmtCurrency(curSaidasTotal)} − ${fmtCurrency(prevSaidasTotal)}) ÷ ${fmtCurrency(prevSaidasTotal)} × 100\n= ${varSaidas.toFixed(1)}%`,
      });
    } else if (prevSaidasTotal > 0 && varSaidas < -10) {
      insights.push({
        id: 'saidas-baixa',
        type: 'success',
        icon: <TrendingDown size={14} />,
        title: 'Controle de saídas positivo',
        description: `Saídas do período (${fmtCurrency(curSaidasTotal)}) reduziram ${Math.abs(varSaidas).toFixed(0)}% vs mês anterior (${fmtCurrency(prevSaidasTotal)}).`,
        value: `${varSaidas.toFixed(0)}% saídas`,
        formula: `Fórmula: (Atual − Anterior) ÷ Anterior × 100\n= (${fmtCurrency(curSaidasTotal)} − ${fmtCurrency(prevSaidasTotal)}) ÷ ${fmtCurrency(prevSaidasTotal)} × 100\n= ${varSaidas.toFixed(1)}%`,
      });
    }

    if (prevEntradasTotal > 0 && curEntradasTotal > 0) {
      if (varEntradas > 15) {
        insights.push({
          id: 'entradas-alta',
          type: 'success',
          icon: <TrendingUp size={14} />,
          title: 'Crescimento de entrada',
          description: `Entradas (${fmtCurrency(curEntradasTotal)}) cresceram ${varEntradas.toFixed(0)}% vs mês anterior (${fmtCurrency(prevEntradasTotal)}).`,
          value: `+${varEntradas.toFixed(0)}% entrada`,
          formula: `Fórmula: (Atual − Anterior) ÷ Anterior × 100\n= (${fmtCurrency(curEntradasTotal)} − ${fmtCurrency(prevEntradasTotal)}) ÷ ${fmtCurrency(prevEntradasTotal)} × 100\n= ${varEntradas.toFixed(1)}%`,
        });
      } else if (varEntradas < -15) {
        insights.push({
          id: 'entradas-baixa',
          type: 'danger',
          icon: <TrendingDown size={14} />,
          title: 'Queda nas entradas',
          description: `Entradas (${fmtCurrency(curEntradasTotal)}) caíram ${Math.abs(varEntradas).toFixed(0)}% vs mês anterior (${fmtCurrency(prevEntradasTotal)}).`,
          value: `${varEntradas.toFixed(0)}% entrada`,
          formula: `Fórmula: (Atual − Anterior) ÷ Anterior × 100\n= (${fmtCurrency(curEntradasTotal)} − ${fmtCurrency(prevEntradasTotal)}) ÷ ${fmtCurrency(prevEntradasTotal)} × 100\n= ${varEntradas.toFixed(1)}%`,
        });
      }
    }
  }

  if (curSaidasTotal > 0 && curEntradasTotal > 0) {
    const ratio = curSaidasTotal / curEntradasTotal;
    if (ratio > 0.9) {
      insights.push({
        id: 'fluxo-critico',
        type: 'danger',
        icon: <AlertTriangle size={14} />,
        title: 'Fluxo de caixa crítico',
        description: `Saídas (${fmtCurrency(curSaidasTotal)}) = ${(ratio * 100).toFixed(0)}% das entradas (${fmtCurrency(curEntradasTotal)}). Margem muito estreita.`,
        value: `${(ratio * 100).toFixed(0)}% das entradas`,
        formula: `Fórmula: Saídas ÷ Entradas × 100\n= ${fmtCurrency(curSaidasTotal)} ÷ ${fmtCurrency(curEntradasTotal)} × 100\n= ${(ratio * 100).toFixed(1)}%`,
      });
    } else if (ratio > 0.7) {
      insights.push({
        id: 'fluxo-atencao',
        type: 'warning',
        icon: <Zap size={14} />,
        title: 'Atenção ao fluxo de caixa',
        description: `Saídas são ${(ratio * 100).toFixed(0)}% das entradas no período. Monitore para manter margem saudável.`,
        value: `${(ratio * 100).toFixed(0)}% das entradas`,
        formula: `Fórmula: Saídas ÷ Entradas × 100\n= ${fmtCurrency(curSaidasTotal)} ÷ ${fmtCurrency(curEntradasTotal)} × 100\n= ${(ratio * 100).toFixed(1)}%`,
      });
    } else {
      insights.push({
        id: 'fluxo-ok',
        type: 'success',
        icon: <Award size={14} />,
        title: 'Fluxo de caixa saudável',
        description: `Saídas (${(ratio * 100).toFixed(0)}% das entradas) — boa margem operacional.`,
        value: `${(ratio * 100).toFixed(0)}% das entradas`,
        formula: `Fórmula: Saídas ÷ Entradas × 100\n= ${fmtCurrency(curSaidasTotal)} ÷ ${fmtCurrency(curEntradasTotal)} × 100\n= ${(ratio * 100).toFixed(1)}%`,
      });
    }
  }

  // ── Top natureza do período ──────────────────────────────────────────────
  const periodNat = getNaturezaTotals(saidasCur);
  if (periodNat.length > 0) {
    const top = periodNat[0];
    insights.push({
      id: 'top-natureza',
      type: 'info',
      icon: <ShoppingBag size={14} />,
      title: `"${top.natureza}" é o maior gasto`,
      description: `${top.percentual.toFixed(0)}% do total de saídas do período (${fmtCurrency(top.total)} de ${fmtCurrency(curSaidasTotal)}).`,
      value: `${top.percentual.toFixed(0)}% do total de saídas`,
      formula: `Fórmula: Natureza ÷ Total Saídas × 100\n= ${fmtCurrency(top.total)} ÷ ${fmtCurrency(curSaidasTotal)} × 100\n= ${top.percentual.toFixed(1)}%`,
    });
  }

  // ── Melhor dia de vendas ─────────────────────────────────────────────────
  if (entradasCur.length > 0) {
    const dowTotals = getDayOfWeekTotals(entradasCur);
    const best  = [...dowTotals].sort((a, b) => b.total - a.total)[0];
    const worst = [...dowTotals].sort((a, b) => a.total - b.total).find((d) => d.total > 0);
    if (best && best.total > 0) {
      const totalRec = sumRealizado(entradasCur);
      const bestPct = totalRec > 0 ? (best.total / totalRec) * 100 : 0;
      insights.push({
        id: 'best-day',
        type: 'tip',
        icon: <Star size={14} />,
        title: `${best.name} é o melhor dia de vendas`,
        description: `${best.name} concentra ${bestPct.toFixed(0)}% da entrada do período${worst ? `. ${worst.name} é o dia mais fraco` : ''}.`,
        value: `${bestPct.toFixed(0)}% da entrada`,
        formula: `Fórmula: Entrada do dia ÷ Total Entradas × 100\n= ${fmtCurrency(best.total)} ÷ ${fmtCurrency(totalRec)} × 100\n= ${bestPct.toFixed(1)}%`,
      });
    }
  }

  return insights.slice(0, 7);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  saidas: Transaction[];
  entradas: Transaction[];
  saidasCur: Transaction[];
  entradasCur: Transaction[];
}

const TYPE_STYLES = {
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  info:    'bg-blue-50 border-blue-200 text-blue-700',
  danger:  'bg-red-50 border-red-200 text-red-700',
  tip:     'bg-violet-50 border-violet-200 text-violet-700',
};

const IMPACT_STYLES = {
  'muito-alto': 'bg-red-100 text-red-700',
  'alto':       'bg-orange-100 text-orange-700',
  'médio':      'bg-yellow-100 text-yellow-700',
  'baixo':      'bg-slate-100 text-slate-500',
};

const CATEGORY_ICONS: Record<string, string> = {
  feriado:   '🎉',
  varejo:    '🛍️',
  temporada: '🌿',
};

export function InsightsPanel({ saidas, entradas, saidasCur, entradasCur }: Props) {
  const refDate = new Date();
  const insights = generateInsights(saidas, entradas, saidasCur, entradasCur, refDate);
  const events = getSeasonalEvents(refDate);

  const hasData = saidas.length > 0 || entradas.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Insights */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={16} className="text-amber-500" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Insights do Período</h2>
        </div>

        {!hasData ? (
          <p className="text-xs text-slate-400 text-center py-6">
            Carregue as planilhas para visualizar os insights.
          </p>
        ) : (
          <div className="space-y-2">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className={`flex gap-3 p-3 rounded-xl border ${TYPE_STYLES[ins.type]}`}
              >
                <span className="shrink-0 mt-0.5">{ins.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-tight flex items-center gap-0.5">
                    {ins.title}
                    {ins.formula && <InfoTooltip content={ins.formula} />}
                  </p>
                  <p className="text-[11px] mt-0.5 opacity-80 leading-relaxed">{ins.description}</p>
                </div>
                {ins.value && (
                  <span className="shrink-0 text-[11px] font-bold self-start mt-0.5 text-right max-w-[90px] leading-tight">
                    {ins.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seasonal Calendar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-rose-500" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Calendário do Varejo</h2>
          <span className="ml-auto text-[10px] text-slate-400">próximos 90 dias</span>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-80">
          {events.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">
              Nenhuma data especial nos próximos 90 dias.
            </p>
          )}
          {events.map((ev) => (
            <div key={ev.name} className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-base shrink-0">{CATEGORY_ICONS[ev.category]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-bold text-slate-800">{ev.name}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${IMPACT_STYLES[ev.impact]}`}>
                    {ev.impact.replace('-', ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-1">{ev.tip}</p>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">{ev.date}</span>
                  <span className={`text-[10px] font-semibold ${ev.daysUntil < 0 ? 'text-slate-400' : ev.daysUntil <= 14 ? 'text-red-500' : ev.daysUntil <= 30 ? 'text-amber-500' : 'text-slate-500'}`}>
                    {ev.daysUntil < 0 ? `${Math.abs(ev.daysUntil)}d atrás` : ev.daysUntil === 0 ? 'Hoje!' : `em ${ev.daysUntil} dias`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
