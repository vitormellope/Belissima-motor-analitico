import * as XLSX from 'xlsx';
import type { Transaction } from '../types';

function parseDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || 0;
  return 0;
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

        // Verificar se é CSV ou Excel
        if (file.name.endsWith('.csv')) {
          // Parse CSV
          const csvText = new TextDecoder().decode(new Uint8Array(result));
          rows = csvText.split('\n')
            .filter(line => line.trim())
            .map(line => line.split(',').map(cell => cell.trim()));
        } else {
          // Parse Excel
          const data = new Uint8Array(result);
          const wb = XLSX.read(data, { type: 'array', cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
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

        // Saídas / Contas a Pagar format
        const colIdx = {
          numero: headers.findIndex((h) => h.includes('número') || h.includes('numero')),
          tipo: headers.findIndex((h) => h === 'tipo'),
          empresa: headers.findIndex((h) => h === 'empresa'),
          natureza: headers.findIndex((h) => h === 'natureza'),
          data: headers.findIndex((h) => h === 'data'),
          vPrevisto: headers.findIndex((h) => h.includes('previsto')),
          vRealizado: headers.findIndex((h) => h.includes('realizado')),
          conta: headers.findIndex((h) => h === 'conta'),
          fornecedor: headers.findIndex((h) => h === 'fornecedor'),
        };

        const transactions: Transaction[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (!row || row.length === 0) continue;

          const dateVal = row[colIdx.data >= 0 ? colIdx.data : 4];
          const dt = parseDate(dateVal);
          if (!dt) continue;

          const natureza = String(
            row[colIdx.natureza >= 0 ? colIdx.natureza : 3] ?? ''
          ).trim();
          if (!natureza) continue;

          transactions.push({
            numero: parseNum(row[colIdx.numero >= 0 ? colIdx.numero : 0]),
            tipo: String(row[colIdx.tipo >= 0 ? colIdx.tipo : 1] ?? ''),
            empresa: String(row[colIdx.empresa >= 0 ? colIdx.empresa : 2] ?? ''),
            natureza,
            data: dt,
            vPrevisto: parseNum(row[colIdx.vPrevisto >= 0 ? colIdx.vPrevisto : 7]),
            vRealizado: parseNum(row[colIdx.vRealizado >= 0 ? colIdx.vRealizado : 8]),
            conta: String(row[colIdx.conta >= 0 ? colIdx.conta : 9] ?? ''),
            fornecedor: String(row[colIdx.fornecedor >= 0 ? colIdx.fornecedor : 10] ?? ''),
            source,
          });
        }
        resolve(transactions);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
