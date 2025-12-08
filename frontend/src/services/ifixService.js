import { supabase } from './supabaseClient.js';

export async function getIfixByDate(date) {
  const { data, error } = await supabase
    .from('ifix_history')
    .select('close_value')
    .eq('trade_date', date)
    .single();

  if (error) throw error;
  return data?.close_value ?? null;
}

export async function getIfixRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('ifix_history')
    .select('trade_date, close_value')
    .gte('trade_date', startDate)
    .lte('trade_date', endDate)
    .order('trade_date', { ascending: true });

  if (error) throw error;
  return data;
}

export function normalizeIfixSeries(ifixSeries) {
  if (!ifixSeries || ifixSeries.length === 0) return [];

  const firstValue = ifixSeries[0].close_value;

  return ifixSeries.map((row) => ({
    ...row,
    normalized: (row.close_value / firstValue) * 100,
  }));
}

export async function getIfixNormalizedRange(startDate, endDate) {
  const series = await getIfixRange(startDate, endDate);
  return normalizeIfixSeries(series);
}
