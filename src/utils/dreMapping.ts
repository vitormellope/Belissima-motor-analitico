import type { Transaction } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Saldo inicial de caixa em jan/2026 (soma das 3 contas: Bradesco + Itaú + Tesouraria).
// Semeia o Fluxo de Caixa acumulado — não é dividido por conta nos cálculos.
export const SALDO_INICIAL_CAIXA = 264853.71 + 141429.42 + 172606.95; // R$ 578.890,08

export type DRECategoria = 'CUSTO' | 'DESPESA_OPERACIONAL' | 'DESPESA_ADMINISTRATIVA' | 'FINANCEIRO' | 'INVESTIMENTO' | 'Outros';

export interface DREItem {
  natureza: string;
  categoria: DRECategoria;
  subcategoria: string;
}

export const DRE_MAPEAMENTO: DREItem[] = [
  { natureza: 'COMPRA DE MERCADORIAS', categoria: 'CUSTO', subcategoria: 'CMC - Mercadoria' },
  { natureza: 'FRETES MERCADORIAS', categoria: 'CUSTO', subcategoria: 'CMC - Frete entrada' },
  { natureza: 'EMBALAGENS E ETIQUETAS', categoria: 'CUSTO', subcategoria: 'Custo variavel' },
  { natureza: 'DIREITO AUTORAL', categoria: 'CUSTO', subcategoria: 'Royalties produto' },
  { natureza: 'SALÁRIOS', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Pessoal loja' },
  { natureza: 'FÉRIAS', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Pessoal' },
  { natureza: 'EXTRA FUNCIONARIO', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Pessoal' },
  { natureza: 'GRATIFICAÇÃO', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Pessoal variavel' },
  { natureza: 'PASSAGENS / VALE TRANPORTES', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Beneficios' },
  { natureza: 'ALIMENTAÇÃO', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Beneficios' },
  { natureza: 'UNIFORMES FUNCIONÁRIOS', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Pessoal' },
  { natureza: 'MEDICINA DO TRABALHO', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Saude ocupacional' },
  { natureza: 'INSS', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Encargos' },
  { natureza: 'FGTS', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Encargos' },
  { natureza: 'OUTRAS DESPESAS C/ FUNCIONÁRIOS', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Pessoal' },
  { natureza: 'ALUGUEL', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Ocupacao' },
  { natureza: 'IPTU', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Ocupacao' },
  { natureza: 'LUZ', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Utilidades' },
  { natureza: 'ÁGUA MENSAL', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Utilidades' },
  { natureza: 'LIMPEZA', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Conservacao' },
  { natureza: 'ALARMES E SIST. DE SEGURANÇA', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Seguranca' },
  { natureza: 'SEGURO DE LOJAS', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Seguros' },
  { natureza: 'MANUTENÇÃO DE EQUIPAMENTOS', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Manutencao' },
  { natureza: 'DESPESAS LOJA', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Operacao loja' },
  { natureza: 'DESPESAS LOJA MEIER', categoria: 'Outros', subcategoria: 'Transferencia interna' },
  { natureza: 'DESPESAS LOJA WEST SHOPPING', categoria: 'Outros', subcategoria: 'Transferencia interna' },
  { natureza: 'DESPESAS LOJA NITEROI', categoria: 'Outros', subcategoria: 'Transferencia interna' },
  { natureza: 'DESPESAS LOJA AMERICA SHOPPING RECREIO', categoria: 'Outros', subcategoria: 'Transferencia interna' },
  { natureza: 'FURO DE CAIXA', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Perdas operacionais' },
  { natureza: 'PROPAGANDA MARKENTING', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Marketing' },
  { natureza: 'BLOGUEIRA', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Marketing influencia' },
  { natureza: 'COMISSÃO FORNECEDOR TALITA', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Comissoes' },
  { natureza: 'COMISSÃO FORNECEDOR FEFE', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Comissoes' },
  { natureza: 'COMISSÃO FORNECEDOR RAFAEL SP', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Comissoes' },
  { natureza: 'CORREIO', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Logistica saida' },
  { natureza: 'PEDÁGIO', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Logistica/deslocamento' },
  { natureza: 'COMBUSTIVEIS / LUBRIFICANTES', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Frota/deslocamento' },
  { natureza: 'ESTACIONAMENTO', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Deslocamento' },
  { natureza: 'CONTABILIDADE', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Servicos profissionais' },
  { natureza: 'ADVOGADOS', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Servicos juridicos' },
  { natureza: 'INTERNET', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Telecom/TI' },
  { natureza: 'TELEFONE', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Telecom' },
  { natureza: 'SISTEMAS DE INFORMATICA', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'TI/Sistemas' },
  { natureza: 'MATERIAL DE ESCRITÓRIO', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Suprimentos' },
  { natureza: 'ALIMENTOS ESCRITORIO', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Copa/escritorio' },
  { natureza: 'SERVIÇOS DIVERSOS TERCEIROS', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Terceiros' },
  { natureza: 'ACIB ASSOCIAÇÃO COMERCIAL', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Associacoes' },
  { natureza: 'SINDICATO LOGISTA COMERCIO RJ', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Sindicato patronal' },
  { natureza: 'SEGURO VEICULOS', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Frota/Seguros' },
  { natureza: 'IPVA', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Frota/Impostos' },
  { natureza: 'LICENCIAMENTO ANUAL', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Frota/Documentacao' },
  { natureza: 'CONSERTOS E MANUTENÇÃO DE VEICULOS', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Frota/Manutenção' },
  { natureza: 'DESPESAS VIAGEM', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Viagens' },
  { natureza: 'DAS SIMPLES NACIONAL', categoria: 'FINANCEIRO', subcategoria: 'Tributos sobre faturamento' },
  { natureza: 'IMPOSTOS E TAXAS', categoria: 'FINANCEIRO', subcategoria: 'Tributos diversos' },
  { natureza: 'MULTAS E JUROS', categoria: 'FINANCEIRO', subcategoria: 'Juros e multas' },
  { natureza: 'DEVOLUÇÃO DINHEIRO AO CLIENTE', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Deducoes de venda' },
  { natureza: 'RESCISOES', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Rescisoes' },
  { natureza: 'MULTA RECISÓRIA', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Rescisoes' },
  { natureza: 'DESPESAS EXPANSÃO LOJA WEST SHOPPING', categoria: 'Outros', subcategoria: 'Expansao' },
  { natureza: 'COMPRA DE EQUIPAMENTOS', categoria: 'INVESTIMENTO', subcategoria: 'Imobilizado' },
  { natureza: 'ADIANTAMENTO SALARIAL', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Pessoal Adiantamentos' },
  { natureza: 'RETIRADA DE SÓCIOS', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Dividendos/Socios' },
  { natureza: 'PAGAMENTO DE OUTRAS LOJAS', categoria: 'Outros', subcategoria: 'Transferencia interna' },
  { natureza: 'PRO-LABORE', categoria: 'DESPESA_ADMINISTRATIVA', subcategoria: 'Pessoal socios' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type DRERowStyle = 'receita' | 'deducao' | 'despesa' | 'subtotal' | 'resultado' | 'fluxo';

export interface DREGroup {
  subcategoria: string;
  total: number;
  months: Record<string, number>;
  transactions: Transaction[];
}

export interface DRELine {
  linha: number;
  descricao: string;
  sinal: '+' | '-' | null;
  rowStyle: DRERowStyle;
  total: number;
  months: Record<string, number>;
  groups: DREGroup[];
  transactions: Transaction[];
  expandable: boolean;
}

export interface DREResult {
  lines: DRELine[];
  monthKeys: string[];
  monthLabels: string[];
  unmapped: { natureza: string; total: number; months: Record<string, number> }[];
  saldoInicial: number;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildDRE(saidas: Transaction[], entradas: Transaction[]): DREResult {
  // Collect all month keys from both datasets
  const monthsSet = new Set<string>();
  for (const t of [...saidas, ...entradas]) {
    if (!t.data) continue;
    monthsSet.add(`${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthKeys = Array.from(monthsSet).sort();
  const monthLabels = monthKeys.map((k) => {
    const [y, m] = k.split('-');
    return format(new Date(Number(y), Number(m) - 1, 1), "MMMM yyyy", { locale: ptBR });
  });

  // Build normalized lookup map
  const dreMap = new Map<string, DREItem>();
  for (const item of DRE_MAPEAMENTO) {
    dreMap.set(item.natureza.toUpperCase().trim(), item);
  }

  const DEDUCAO: DREItem = { natureza: '', categoria: 'DESPESA_OPERACIONAL', subcategoria: 'Deducoes de venda' };

  // Classificação por lançamento — aplica overrides por fornecedor antes do mapa por natureza.
  // Regras: impostos sobre a venda vão para "Deduções de Vendas" (topo do DRE):
  //  - DAS SIMPLES NACIONAL (qualquer DAS)
  //  - IMPOSTOS E TAXAS da Prefeitura do Rio (ISS-like)
  //  - SISTEMAS DE INFORMATICA da NOVA FERREIRA (imposto disfarçado)
  function classify(t: Transaction): DREItem | undefined {
    const nat = t.natureza.toUpperCase().trim();
    const forn = (t.fornecedor ?? '').toUpperCase().trim();
    if (/\bDAS\b/.test(nat)) return DEDUCAO; // \b evita casar "venDAS do dia"
    if (nat === 'IMPOSTOS E TAXAS' && forn.includes('PREFEITURA DA CIDADE DO RIO DE JANEIRO')) return DEDUCAO;
    if (nat === 'SISTEMAS DE INFORMATICA' && forn.includes('NOVA FERREIRA')) return DEDUCAO;
    return dreMap.get(nat);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const emptyMap = (): Record<string, number> =>
    Object.fromEntries(monthKeys.map((k) => [k, 0]));

  function sumByMonth(txs: Transaction[]): Record<string, number> {
    const result = emptyMap();
    for (const t of txs) {
      if (!t.data) continue;
      const mk = `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}`;
      if (mk in result) result[mk] += t.vRealizado;
    }
    return result;
  }

  function mSub(a: Record<string, number>, ...bs: Record<string, number>[]): Record<string, number> {
    const result = { ...a };
    for (const b of bs) for (const mk of monthKeys) result[mk] -= b[mk] ?? 0;
    return result;
  }

  function filterSaidas(
    cat: DRECategoria | null,
    subcat?: string,
    excludeSubcat?: string
  ): Transaction[] {
    return saidas.filter((t) => {
      const item = classify(t);
      if (!item) return false;
      if (cat !== null && item.categoria !== cat) return false;
      if (subcat && item.subcategoria !== subcat) return false;
      if (excludeSubcat && item.subcategoria === excludeSubcat) return false;
      return true;
    });
  }

  function groupBySubcat(txs: Transaction[]): DREGroup[] {
    const subOf = (t: Transaction) => classify(t)?.subcategoria ?? t.natureza;
    const subs = Array.from(new Set(txs.map(subOf)));
    return subs
      .map((subcategoria) => {
        const matched = txs.filter((t) => subOf(t) === subcategoria);
        return {
          subcategoria,
          total: matched.reduce((a, t) => a + t.vRealizado, 0),
          months: sumByMonth(matched),
          transactions: matched,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  function totTxs(txs: Transaction[]) {
    return txs.reduce((a, t) => a + t.vRealizado, 0);
  }

  function sumMap(m: Record<string, number>) {
    return Object.values(m).reduce((a, b) => a + b, 0);
  }

  // ── Data groups ───────────────────────────────────────────────────────────

  const grpEntradas = entradas;
  const grpDeducoes = filterSaidas('DESPESA_OPERACIONAL', 'Deducoes de venda');
  const grpCOGS = filterSaidas('CUSTO');
  const grpOPEX = filterSaidas('DESPESA_OPERACIONAL', undefined, 'Deducoes de venda');
  const grpSGA = saidas.filter((t) => {
    const item = classify(t);
    return item?.categoria === 'DESPESA_ADMINISTRATIVA' && item.subcategoria !== 'Dividendos/Socios';
  });
  const grpFinanceiro = filterSaidas('FINANCEIRO');
  const grpCAPEX = filterSaidas('INVESTIMENTO');
  const grpDividendos = saidas.filter(
    (t) => classify(t)?.subcategoria === 'Dividendos/Socios'
  );
  const grpOutrasSaidas = filterSaidas('Outros');
  const unmappedTxs = saidas.filter((t) => !classify(t));

  // ── Month maps ────────────────────────────────────────────────────────────

  const mL1  = sumByMonth(grpEntradas);
  const mL2  = sumByMonth(grpDeducoes);
  const mL3  = mSub(mL1, mL2);                   // Receita Líquida
  const mL4  = sumByMonth(grpCOGS);
  const mL5  = mSub(mL3, mL4);                   // Lucro Bruto
  const mL6  = sumByMonth(grpOPEX);
  const mL7  = mSub(mL5, mL6);                   // Lucro Operacional Bruto
  const mL8  = sumByMonth(grpSGA);
  const mL9  = mSub(mL7, mL8);                   // EBITA
  const mL10 = emptyMap();                        // IR/CSLL (Simples = não segregado)
  const mL11 = sumByMonth(grpFinanceiro);
  const mL12 = mSub(mSub(mL9, mL10), mL11);      // Lucro Líquido
  const mL13 = sumByMonth(grpCAPEX);
  const mL14 = sumByMonth(grpDividendos);
  const mL15 = emptyMap();                        // Outras Entradas
  const mL16 = sumByMonth(grpOutrasSaidas);
  const mL17 = mSub(mSub(mSub(mL12, mL13), mL14), mL16); // Resultado do Mês

  // Fluxo de Caixa: acumulado progressivo, partindo do saldo inicial de caixa (jan/2026)
  // Cada mês = saldo inicial + soma dos Resultados (L17) até o mês
  const mL18 = emptyMap();
  let fluxoAcumulado = SALDO_INICIAL_CAIXA;
  for (const mk of monthKeys) {
    fluxoAcumulado += mL17[mk] ?? 0;
    mL18[mk] = fluxoAcumulado;
  }

  // ── Unmapped summary ──────────────────────────────────────────────────────

  const unmappedMap = new Map<string, { total: number; months: Record<string, number> }>();
  for (const t of unmappedTxs) {
    if (!unmappedMap.has(t.natureza)) {
      unmappedMap.set(t.natureza, { total: 0, months: emptyMap() });
    }
    const cur = unmappedMap.get(t.natureza)!;
    cur.total += t.vRealizado;
    const mk = `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, '0')}`;
    if (mk in cur.months) cur.months[mk] += t.vRealizado;
  }
  const unmapped = Array.from(unmappedMap.entries())
    .map(([natureza, data]) => ({ natureza, ...data }))
    .sort((a, b) => b.total - a.total);

  // ── Lines ─────────────────────────────────────────────────────────────────

  const lines: DRELine[] = [
    { linha: 1,  descricao: '(+) Receita Bruta',                        sinal: '+',  rowStyle: 'receita',   total: totTxs(grpEntradas),      months: mL1,  groups: groupBySubcat(grpEntradas),      transactions: grpEntradas,      expandable: grpEntradas.length > 0 },
    { linha: 2,  descricao: '(-) Deduções de Vendas',                   sinal: '-',  rowStyle: 'deducao',   total: totTxs(grpDeducoes),       months: mL2,  groups: groupBySubcat(grpDeducoes),  transactions: grpDeducoes,  expandable: grpDeducoes.length > 0 },
    { linha: 3,  descricao: 'Receita Líquida',                          sinal: null, rowStyle: 'subtotal',  total: sumMap(mL3),                months: mL3,  groups: [],                          transactions: [],                          expandable: false },
    { linha: 4,  descricao: '(-) Custo de Mercadorias Compradas',       sinal: '-',  rowStyle: 'despesa',   total: totTxs(grpCOGS),           months: mL4,  groups: groupBySubcat(grpCOGS),      transactions: grpCOGS,      expandable: grpCOGS.length > 0 },
    { linha: 5,  descricao: 'Lucro Bruto',                              sinal: null, rowStyle: 'subtotal',  total: sumMap(mL5),                months: mL5,  groups: [],                          transactions: [],                          expandable: false },
    { linha: 6,  descricao: '(-) Despesas Operacionais (OPEX)',         sinal: '-',  rowStyle: 'despesa',   total: totTxs(grpOPEX),           months: mL6,  groups: groupBySubcat(grpOPEX),      transactions: grpOPEX,      expandable: grpOPEX.length > 0 },
    { linha: 7,  descricao: 'Lucro Operacional Bruto',                  sinal: null, rowStyle: 'subtotal',  total: sumMap(mL7),                months: mL7,  groups: [],                          transactions: [],                          expandable: false },
    { linha: 8,  descricao: '(-) Vendas, Gerais e Administrativo (SG&A)', sinal: '-', rowStyle: 'despesa',  total: totTxs(grpSGA),            months: mL8,  groups: groupBySubcat(grpSGA),        transactions: grpSGA,        expandable: grpSGA.length > 0 },
    { linha: 9,  descricao: 'Lucro Operacional (EBITA)',                sinal: null, rowStyle: 'subtotal',  total: sumMap(mL9),                months: mL9,  groups: [],                          transactions: [],                          expandable: false },
    { linha: 11, descricao: '(-) Despesas Financeiras',                 sinal: '-',  rowStyle: 'despesa',   total: totTxs(grpFinanceiro),      months: mL11, groups: groupBySubcat(grpFinanceiro), transactions: grpFinanceiro, expandable: grpFinanceiro.length > 0 },
    { linha: 12, descricao: 'Lucro Líquido',                            sinal: null, rowStyle: 'subtotal',  total: sumMap(mL12),               months: mL12, groups: [],                          transactions: [],                          expandable: false },
    { linha: 13, descricao: '(-) Saídas de Capital (CAPEX)',            sinal: '-',  rowStyle: 'despesa',   total: totTxs(grpCAPEX),          months: mL13, groups: groupBySubcat(grpCAPEX),     transactions: grpCAPEX,     expandable: grpCAPEX.length > 0 },
    { linha: 14, descricao: '(-) Dividendos',                           sinal: '-',  rowStyle: 'deducao',   total: totTxs(grpDividendos),      months: mL14, groups: groupBySubcat(grpDividendos), transactions: grpDividendos, expandable: grpDividendos.length > 0 },
    { linha: 15, descricao: '(+) Outras Entradas',                      sinal: '+',  rowStyle: 'receita',   total: 0,                          months: mL15, groups: [],                          transactions: [],                          expandable: false },
    { linha: 16, descricao: '(-) Outras Saídas',                        sinal: '-',  rowStyle: 'despesa',   total: totTxs(grpOutrasSaidas),    months: mL16, groups: groupBySubcat(grpOutrasSaidas), transactions: grpOutrasSaidas, expandable: grpOutrasSaidas.length > 0 },
    { linha: 17, descricao: 'Resultado do Mês',                         sinal: null, rowStyle: 'resultado', total: sumMap(mL17),               months: mL17, groups: [],                          transactions: [],                          expandable: false },
    { linha: 18, descricao: 'Fluxo de Caixa',                          sinal: null, rowStyle: 'fluxo',     total: fluxoAcumulado,             months: mL18, groups: [],                          transactions: [],                          expandable: false },
  ];

  return { lines, monthKeys, monthLabels, unmapped, saldoInicial: SALDO_INICIAL_CAIXA };
}
