import { supabase } from './supabaseClient.js';

export async function getIbovRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('ibov_history')
    .select('trade_date, close_value')
    .gte('trade_date', startDate)
    .lte('trade_date', endDate)
    .order('trade_date', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getLastIbovDate() {
  const { data, error } = await supabase
    .from('ibov_history')
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data?.trade_date;
}
