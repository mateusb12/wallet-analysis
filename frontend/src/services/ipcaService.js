import { supabase } from './supabaseClient.js';

const BCB_IPCA_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json';

export async function getIpcaForMonth(year, month) {
  const refDate = `${year}-${String(month).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('ipca_history')
    .select('ipca')
    .eq('ref_date', refDate)
    .single();

  if (error) throw error;
  return data?.ipca ?? null;
}

export async function getIpcaRange(startYear, startMonth, endYear, endMonth) {
  const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('ipca_history')
    .select('*')
    .gte('ref_date', startDate)
    .lte('ref_date', endDate)
    .order('ref_date', { ascending: true });

  if (error) throw error;
  return data;
}

export function calculateAccumulatedFactor(ipcaSeries) {
  return ipcaSeries.reduce((acc, row) => acc * (1 + row.ipca / 100), 1);
}

export function correctValue(initialValue, factor) {
  return initialValue * factor;
}

function bcbDateToIso(bcbDate) {
  const [day, month, year] = bcbDate.split('/');
  return `${year}-${month}-${day}`;
}

function parseBcbValue(valor) {
  return parseFloat(valor.replace(',', '.'));
}

export async function syncIpcaHistory() {
  const { data: lastRows, error: lastErr } = await supabase
    .from('ipca_history')
    .select('ref_date')
    .order('ref_date', { ascending: false })
    .limit(1);

  if (lastErr) throw lastErr;

  const lastRefDate = lastRows?.[0]?.ref_date ?? null;

  const response = await fetch(BCB_IPCA_URL);
  if (!response.ok) {
    throw new Error(`Erro ao buscar IPCA no BCB: ${response.status}`);
  }

  const bcbJson = await response.json();

  const allRows = bcbJson.map((entry) => ({
    ref_date: bcbDateToIso(entry.data),
    ipca: parseBcbValue(entry.valor),
  }));

  const rowsToInsert = lastRefDate ? allRows.filter((row) => row.ref_date > lastRefDate) : allRows;

  if (rowsToInsert.length === 0) {
    return { inserted: 0, message: 'IPCA já está atualizado' };
  }

  const { error: insertErr } = await supabase.from('ipca_history').insert(rowsToInsert);

  if (insertErr) throw insertErr;

  return {
    inserted: rowsToInsert.length,
    from: rowsToInsert[0].ref_date,
    to: rowsToInsert[rowsToInsert.length - 1].ref_date,
  };
}

export async function getLastIpcaDate() {
  const { data, error } = await supabase
    .from('ipca_history')
    .select('ref_date')
    .order('ref_date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Erro ao buscar última data do IPCA:', error.message);
    return null;
  }
  return data?.ref_date;
}
