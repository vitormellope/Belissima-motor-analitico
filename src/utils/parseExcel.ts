import * as XLSX from 'xlsx';
import type { Transaction } from '../types';

function parseDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === 'string') {
    // Formato brasileiro dd/mm/yyyy — tem que ser o primeiro a testar
    const br = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) {
      const d = new Date(parseInt(br[3]), parseInt(br[2]) - 1, parseInt(br[1]));
      if (!isNaN(d.getTime())) return d;
    }
    // Fallback para ISO ou outros formatos
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove "R$", espaços, e converte formato BR (2.940,00 → 2940.00)
    const s = val.replace(/R\$\s*/g, '').trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  }
  return 0;
}

// Parse HTML tables (para arquivos HTML disfarçados de XLS)
function parseHTMLTable(html: string): unknown[][] {
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>(.*?)<\/td>/gs;
  let match;

  while ((match = cellRegex.exec(html)) !== null) {
    const cell = match[1].replace(/<[^>]+>/g, '').trim();
    if (cell && cell !== '&nbsp;') {
      cells.push(cell);
    }
  }

  if (cells.length === 0) return [];

  // Detectar quantas colunas tem (por heurística)
  // Procura por padrões de data (dd/mm/yyyy) para detectar colunas
  let colCount = 1;
  for (let i = 0; i < Math.min(50, cells.length); i++) {
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(cells[i])) {
      // Encontrou uma data, calcula coluna
      colCount = i + 1;
      break;
    }
  }

  // Se não encontrou por data, tenta por padrão de valores monetários
  if (colCount === 1) {
    for (let i = 0; i < Math.min(50, cells.length); i++) {
      if (/R\$\s*[\d.,]+/.test(cells[i])) {
        colCount = Math.max(5, Math.ceil((i + 1) / 2));
        break;
      }
    }
  }

  // Se ainda não sabe, usa heurística simples
  if (colCount === 1) {
    colCount = Math.ceil(Math.sqrt(cells.length / 50)); // aprox
  }

  const rows: unknown[][] = [];
  for (let i = 0; i < cells.length; i += colCount) {
    const row = cells.slice(i, i + colCount);
    if (row.length > 0) rows.push(row);
  }

  return rows;
}

function isEntradasFormat(headers: string[]): boolean {
  const h = headers.map((x) => x.toLowerCase().trim());
  const hasTotal = h.some((x) => x.includes('total'));
  const hasDateCol = h.some(
    (x) => x.includes('data') || x.includes('date') || x.includes('data_numero') || x.includes('data_txt')
  );
  return hasTotal && hasDateCol;
}

function parseEntradasFormat(
  rows: unknown[][],
  source: 'saidas' | 'entradas'
): Transaction[] {
  const headers = (rows[0] as unknown[]).map((h) =>
    String(h ?? '').toLowerCase().trim()
  );

  const dateIdx = headers.findIndex(
    (h) => h.includes('data') && (h.includes('numero') || h.includes('numer') || !h.includes('txt'))
  );
  const dateTxtIdx = headers.findIndex((h) => h.includes('data'));
  const totalIdx = headers.findIndex((h) => h.includes('total'));

  console.log('parseEntradasFormat - dateIdx:', dateIdx, 'dateTxtIdx:', dateTxtIdx, 'totalIdx:', totalIdx);

  const transactions: Transaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0) continue;

    const rawDate =
      dateIdx >= 0 ? row[dateIdx] : dateTxtIdx >= 0 ? row[dateTxtIdx] : null;
    const data = parseDate(rawDate);

    if (!data) {
      if (i <= 3) console.log(`Linha ${i}: falha ao parsear data:`, rawDate);
      continue;
    }

    const total = parseNum(row[totalIdx >= 0 ? totalIdx : 1]);
    if (total === 0) {
      if (i <= 3) console.log(`Linha ${i}: total é zero`);
      continue;
    }

    if (i <= 3) console.log(`Linha ${i} parseada com sucesso:`, data, total);

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
  console.log('Total de transações parseadas:', transactions.length);
  return transactions;
}

export function parseExcelFile(
  file: File,
  source: 'saidas' | 'entradas'
): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target!.result as ArrayBuffer;
        let rows: unknown[][];

        // Tentar diferentes formatos de parse
        try {
          // Primeiro, tenta como Excel/CSV
          if (file.name.endsWith('.csv')) {
            const csvText = new TextDecoder().decode(new Uint8Array(result));
            rows = csvText.split('\n')
              .filter(line => line.trim())
              .map(line => line.split(',').map(cell => cell.trim()));
          } else {
            // Tenta como Excel binário
            const data = new Uint8Array(result);
            // cellDates: false evita que o XLSX interprete datas no formato US (MM/DD) quebrando datas BR (DD/MM)
            const wb = XLSX.read(data, { type: 'array', cellDates: false });
            const ws = wb.Sheets[wb.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
          }
        } catch (excelErr) {
          console.log('Falha ao parsear como Excel/CSV, tentando como HTML...');
          // Se falhar, tenta como HTML
          const htmlText = new TextDecoder().decode(new Uint8Array(result));
          rows = parseHTMLTable(htmlText);
        }

        if (!rows.length) {
          console.warn('Arquivo vazio ou sem linhas');
          resolve([]);
          return;
        }

        const headers = (rows[0] as unknown[]).map((h) =>
          String(h ?? '').toLowerCase().trim()
        );

        console.log('Headers encontrados:', headers);
        console.log('É formato entradas?', isEntradasFormat(headers));
        console.log('Total de linhas:', rows.length);

        if (isEntradasFormat(headers)) {
          const result = parseEntradasFormat(rows as unknown[][], source);
          console.log('Entradas parseadas:', result.length);
          resolve(result);
          return;
        }

        // Saídas / Contas a Pagar format - mais flexível
        const colIdx = {
          numero: headers.findIndex((h) => h.includes('número') || h.includes('numero')),
          tipo: headers.findIndex((h) => h === 'tipo'),
          empresa: headers.findIndex((h) => h === 'empresa'),
          natureza: headers.findIndex((h) => h === 'natureza'),
          data: headers.findIndex((h) => h === 'data'),
          vPrevisto: headers.findIndex((h) => h.includes('previsto') || h === 'vprevisto'),
          vRealizado: headers.findIndex((h) => h.includes('realizado') || h === 'vrealizado'),
          conta: headers.findIndex((h) => h === 'conta'),
          fornecedor: headers.findIndex((h) => h === 'fornecedor'),
        };

        console.log('Saídas - colIdx:', colIdx);

        const transactions: Transaction[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (!row || row.length === 0) continue;

          // Encontra a data na linha (pode estar em qualquer coluna com padrão dd/mm/yyyy)
          let dt: Date | null = null;
          let dateVal: unknown = null;

          if (colIdx.data >= 0) {
            dateVal = row[colIdx.data];
            dt = parseDate(dateVal);
          } else {
            // Procura por padrão de data em qualquer coluna
            for (let j = 0; j < row.length; j++) {
              const cell = String(row[j] ?? '');
              if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(cell)) {
                dt = parseDate(cell);
                if (dt) break;
              }
            }
          }

          if (!dt) {
            if (i <= 3) console.log(`Linha ${i}: falha ao encontrar data`, row);
            continue;
          }

          const natureza = String(
            row[colIdx.natureza >= 0 ? colIdx.natureza : 3] ?? ''
          ).trim();
          if (!natureza) continue;

          // Encontra valores monetários
          let vPrev = 0;
          let vReal = 0;

          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] ?? '');
            if (/R\$\s*[\d.,]+/.test(cell)) {
              const val = parseNum(cell);
              if (vPrev === 0) vPrev = val;
              else if (vReal === 0) vReal = val;
            }
          }

          if (vReal === 0) vReal = vPrev; // Se só tiver um valor, usa para ambos

          transactions.push({
            numero: colIdx.numero >= 0 ? parseNum(row[colIdx.numero]) : i,
            tipo: String(row[colIdx.tipo >= 0 ? colIdx.tipo : 1] ?? ''),
            empresa: String(row[colIdx.empresa >= 0 ? colIdx.empresa : 2] ?? ''),
            natureza,
            data: dt,
            vPrevisto: vPrev,
            vRealizado: vReal,
            conta: String(row[colIdx.conta >= 0 ? colIdx.conta : 7] ?? ''),
            fornecedor: String(row[colIdx.fornecedor >= 0 ? colIdx.fornecedor : 8] ?? ''),
            source,
          });

          if (i <= 3) console.log(`Linha ${i} parseada:`, natureza, dt, vPrev, vReal);
        }

        console.log('Total de saídas parseadas:', transactions.length);
        resolve(transactions);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
