import * as XLSX from 'xlsx';
import type { Transaction } from '../types';

const PT_MONTHS: { [key: string]: number } = {
  'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3,
  'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7,
  'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11,
};

function parseDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === 'string') {
    // "Sexta, 02 de janeiro de 2026" — exportação do quadro de vendas
    const ptMatch = val.match(/(\d{1,2})\s+de\s+(\S+)\s+de\s+(\d{4})/i);
    if (ptMatch) {
      const mes = PT_MONTHS[ptMatch[2].toLowerCase()];
      if (mes !== undefined) return new Date(parseInt(ptMatch[3]), mes, parseInt(ptMatch[1]));
    }
    // Formato BR: dd/mm/yyyy
    const brMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (brMatch) {
      const d = new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove "R$", remove pontos de milhar, troca vírgula decimal por ponto
    const s = val.replace(/R\$\s*/g, '').trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  }
  return 0;
}

// Detecta se o arquivo é de entradas (quadro de vendas diário)
function isEntradasFormat(headers: string[], firstDataRow?: unknown[]): boolean {
  const h = headers.map((x) => x.toLowerCase().trim());
  const hasTotal = h.some((x) => x.includes('total'));
  if (!hasTotal) return false;

  // Com coluna de data explícita
  const hasDateCol = h.some((x) => x.includes('data') || x.includes('date'));
  if (hasDateCol) return true;

  // Sem coluna de data: verifica se primeira linha de dados tem mês em português
  if (firstDataRow) {
    const hasPtDate = firstDataRow.some(
      (cell) =>
        typeof cell === 'string' &&
        /\b(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i.test(cell),
    );
    if (hasPtDate) return true;
  }

  return false;
}

function parseEntradasFormat(rows: unknown[][], source: 'saidas' | 'entradas'): Transaction[] {
  const headers = (rows[0] as unknown[]).map((h) => String(h ?? '').toLowerCase().trim());

  // Índice da coluna de data (pelo header)
  let dateIdx = headers.findIndex((h) => h.includes('data') || h.includes('date'));

  // Se não tem no header, descobre pela primeira linha de dados
  if (dateIdx < 0 && rows[1]) {
    const firstRow = rows[1] as unknown[];
    for (let j = 0; j < firstRow.length; j++) {
      if (parseDate(firstRow[j]) !== null) {
        dateIdx = j;
        break;
      }
    }
  }

  // Índice da coluna de total
  const totalIdx = headers.findIndex((h) => h.includes('total'));

  const transactions: Transaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.every((c) => c == null || c === '')) continue;

    const rawDate = dateIdx >= 0 ? row[dateIdx] : row[0];
    const data = parseDate(rawDate);
    if (!data) continue;

    const total = parseNum(totalIdx >= 0 ? row[totalIdx] : row[row.length - 1]);
    if (total === 0) continue;

    transactions.push({
      numero: i,
      tipo: 'RECEITA',
      empresa: 'BELISSIMA - BONSUC.',
      natureza: 'VENDAS DO DIA',
      data,
      vPrevisto: total,
      vRealizado: total,
      conta: 'CAIXA LOJA',
      fornecedor: '',
      source,
    });
  }
  return transactions;
}

function parseSaidasFormat(rows: unknown[][], source: 'saidas' | 'entradas'): Transaction[] {
  const headers = (rows[0] as unknown[]).map((h) => String(h ?? '').toLowerCase().trim());

  const colIdx = {
    numero:     headers.findIndex((h) => h.includes('número') || h.includes('numero')),
    tipo:       headers.findIndex((h) => h === 'tipo'),
    empresa:    headers.findIndex((h) => h === 'empresa'),
    natureza:   headers.findIndex((h) => h === 'natureza'),
    data:       headers.findIndex((h) => h === 'data'),
    vPrevisto:  headers.findIndex((h) => h.includes('previsto')),
    vRealizado: headers.findIndex((h) => h.includes('realizado')),
    conta:      headers.findIndex((h) => h === 'conta'),
    fornecedor: headers.findIndex((h) => h === 'fornecedor'),
  };

  const transactions: Transaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.every((c) => c == null || c === '')) continue;

    // Data: usa coluna detectada ou procura dd/mm/yyyy em qualquer célula
    let dt: Date | null = null;
    if (colIdx.data >= 0) {
      dt = parseDate(row[colIdx.data]);
    } else {
      for (const cell of row) {
        dt = parseDate(cell);
        if (dt) break;
      }
    }
    if (!dt) continue;

    // Natureza: obrigatória para classificar a despesa
    const natureza = String(row[colIdx.natureza >= 0 ? colIdx.natureza : 3] ?? '').trim();
    if (!natureza) continue;

    // Valores: usa colunas detectadas quando existem, senão posição padrão
    const vPrevisto  = parseNum(row[colIdx.vPrevisto  >= 0 ? colIdx.vPrevisto  : 5]);
    const vRealizado = parseNum(row[colIdx.vRealizado >= 0 ? colIdx.vRealizado : 6]);

    transactions.push({
      numero:     parseNum(row[colIdx.numero    >= 0 ? colIdx.numero    : 0]),
      tipo:       String(row[colIdx.tipo        >= 0 ? colIdx.tipo      : 1] ?? ''),
      empresa:    String(row[colIdx.empresa     >= 0 ? colIdx.empresa   : 2] ?? ''),
      natureza,
      data:       dt,
      vPrevisto,
      vRealizado,
      conta:      String(row[colIdx.conta       >= 0 ? colIdx.conta     : 7] ?? ''),
      fornecedor: String(row[colIdx.fornecedor  >= 0 ? colIdx.fornecedor : 8] ?? ''),
      source,
    });
  }
  return transactions;
}

export function parseExcelFile(file: File, source: 'saidas' | 'entradas'): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target!.result as ArrayBuffer;
        let rows: unknown[][];

        if (file.name.endsWith('.csv')) {
          const text = new TextDecoder().decode(new Uint8Array(buffer));
          rows = text
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => line.split(',').map((cell) => cell.trim()));
        } else {
          // cellDates: false para que datas dd/mm/yyyy não sejam reinterpretadas como mm/dd
          const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
        }

        if (!rows.length) { resolve([]); return; }

        // Array.from garante array denso (sem buracos) mesmo quando XLSX retorna array esparso
        const headers = Array.from(rows[0] as unknown[]).map((h) => String(h ?? '').toLowerCase().trim());
        const firstDataRow = rows[1] ? Array.from(rows[1] as unknown[]) : undefined;

        if (isEntradasFormat(headers, firstDataRow)) {
          resolve(parseEntradasFormat(rows as unknown[][], source));
        } else {
          resolve(parseSaidasFormat(rows as unknown[][], source));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
