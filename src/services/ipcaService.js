import { supabase } from './supabaseClient.js';

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
