// Importa as planilhas do sistema de origem (Viniconsult) para o Supabase.
// Uso: node scripts/import.mjs entradas <arquivo.xlsx>
//      node scripts/import.mjs saidas <arquivo.xlsx>
//      node scripts/import.mjs resumo <arquivo.xlsx>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const text = fs.readFileSync(envPath, 'utf-8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  realtime: { transport: ws },
});

const PT_MONTHS = {
  janeiro: 0, fevereiro: 1, março: 2, marco: 2, abril: 3,
  maio: 4, junho: 5, julho: 6, agosto: 7,
  setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

function parseDate(val) {
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof val === 'string') {
    const ptMatch = val.match(/(\d{1,2})\s+de\s+(\S+)\s+de\s+(\d{4})/i);
    if (ptMatch) {
      const mes = PT_MONTHS[ptMatch[2].toLowerCase()];
      if (mes !== undefined) return new Date(Date.UTC(parseInt(ptMatch[3]), mes, parseInt(ptMatch[1])));
    }
    const brMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (brMatch) return new Date(Date.UTC(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1])));
  }
  return null;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function parseNum(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const s = val.replace(/R\$\s*/g, '').trim();
    if (s === '' || s === '-') return 0;
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return 0;
}

function readRows(filePath) {
  const wb = XLSX.read(new Uint8Array(fs.readFileSync(filePath)), { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1 });
}

function headerIndex(headers, ...needles) {
  const h = Array.from(headers).map((x) => String(x ?? '').toLowerCase().trim());
  return h.findIndex((col) => needles.some((n) => col.includes(n)));
}

async function replaceAll(table, matchColumn, matchValue, rows) {
  const del = await supabase.from(table).delete().eq(matchColumn, matchValue);
  if (del.error) throw new Error(`Falha ao limpar ${table}: ${del.error.message}`);

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Falha ao inserir em ${table}: ${error.message}`);
    inserted += chunk.length;
  }
  return inserted;
}

async function replaceAllTable(table, rows) {
  const del = await supabase.from(table).delete().neq('id', 0);
  if (del.error) throw new Error(`Falha ao limpar ${table}: ${del.error.message}`);

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Falha ao inserir em ${table}: ${error.message}`);
    inserted += chunk.length;
  }
  return inserted;
}

function importEntradas(filePath) {
  const rows = readRows(filePath);
  const headers = Array.from(rows[0] ?? []);
  const dateIdx = headerIndex(headers, 'data');
  const valorIdx = headerIndex(headers, 'valor', 'total');

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const dt = parseDate(row[dateIdx]);
    if (!dt) continue;
    const valor = parseNum(row[valorIdx]);
    if (valor === 0) continue;

    out.push({
      source: 'entradas',
      tipo: 'RECEITA',
      empresa: 'BELISSIMA - BONSUC.',
      natureza: 'VENDAS DO DIA',
      data: toISODate(dt),
      v_previsto: valor,
      v_realizado: valor,
      conta: 'CAIXA LOJA',
      fornecedor: null,
      status: null,
    });
  }
  return out;
}

function importSaidas(filePath) {
  const rows = readRows(filePath);
  const headers = Array.from(rows[0] ?? []);
  const tipoIdx = headerIndex(headers, 'tipo');
  const empresaIdx = headerIndex(headers, 'empresa');
  const naturezaIdx = headerIndex(headers, 'natureza');
  const dateIdx = headerIndex(headers, 'data');
  const prevIdx = headerIndex(headers, 'previsto');
  const realIdx = headerIndex(headers, 'realizado');
  const contaIdx = headerIndex(headers, 'conta');
  const fornecedorIdx = headerIndex(headers, 'fornecedor');
  const statusIdx = headerIndex(headers, 'status');

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const dt = parseDate(row[dateIdx]);
    if (!dt) continue;
    const natureza = String(row[naturezaIdx] ?? '').trim();
    if (!natureza) continue;

    out.push({
      source: 'saidas',
      tipo: String(row[tipoIdx] ?? ''),
      empresa: String(row[empresaIdx] ?? ''),
      natureza,
      data: toISODate(dt),
      v_previsto: parseNum(row[prevIdx]),
      v_realizado: parseNum(row[realIdx]),
      conta: String(row[contaIdx] ?? ''),
      fornecedor: String(row[fornecedorIdx] ?? ''),
      status: statusIdx >= 0 ? String(row[statusIdx] ?? '').trim() || null : null,
    });
  }
  return out;
}

function importResumo(filePath) {
  const rows = readRows(filePath);
  const headers = Array.from(rows[0] ?? []);
  const formaIdx = headerIndex(headers, 'forma de pagamento', 'forma');
  const ticketIdx = headerIndex(headers, 'ticket');
  const atendIdx = headerIndex(headers, 'atendimento');
  const pctIdx = headerIndex(headers, 'percentual');
  const tefIdx = headerIndex(headers, 'tef');
  const posIdx = headerIndex(headers, 'pos');
  const valorIdx = headerIndex(headers, 'valor');

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const forma = String(row[formaIdx] ?? '').trim();
    if (!forma) continue;

    out.push({
      forma_pagamento: forma,
      ticket_medio: parseNum(row[ticketIdx]),
      atendimentos: Math.round(parseNum(row[atendIdx])),
      percentual: parseNum(row[pctIdx]),
      tef: tefIdx >= 0 ? parseNum(row[tefIdx]) : null,
      pos: posIdx >= 0 ? parseNum(row[posIdx]) : null,
      valor: parseNum(row[valorIdx]),
    });
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const [kind, filePath] = args.filter((a) => a !== '--dry-run');
  if (!kind || !filePath) {
    console.error('Uso: node scripts/import.mjs <entradas|saidas|resumo> <arquivo.xlsx> [--dry-run]');
    process.exit(1);
  }
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error('Arquivo não encontrado:', absPath);
    process.exit(1);
  }

  if (kind === 'entradas') {
    const rows = importEntradas(absPath);
    const total = rows.reduce((s, r) => s + r.v_realizado, 0);
    console.log(`Entradas: ${rows.length} linhas | Total R$ ${total.toFixed(2)}`);
    console.log('Amostra:', rows.slice(0, 2));
    if (dryRun) return;
    const n = await replaceAll('transactions', 'source', 'entradas', rows);
    console.log(`Inseridas ${n} linhas em transactions (source=entradas)`);
  } else if (kind === 'saidas') {
    const rows = importSaidas(absPath);
    const total = rows.reduce((s, r) => s + r.v_realizado, 0);
    console.log(`Saídas: ${rows.length} linhas | Total R$ ${total.toFixed(2)}`);
    console.log('Amostra:', rows.slice(0, 2));
    if (dryRun) return;
    const n = await replaceAll('transactions', 'source', 'saidas', rows);
    console.log(`Inseridas ${n} linhas em transactions (source=saidas)`);
  } else if (kind === 'resumo') {
    const rows = importResumo(absPath);
    const total = rows.reduce((s, r) => s + r.valor, 0);
    console.log(`Resumo de vendas: ${rows.length} formas de pagamento | Total R$ ${total.toFixed(2)}`);
    console.log('Amostra:', rows.slice(0, 2));
    if (dryRun) return;
    const n = await replaceAllTable('payment_methods_summary', rows);
    console.log(`Inseridas ${n} linhas em payment_methods_summary`);
  } else {
    console.error('Tipo desconhecido:', kind);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
