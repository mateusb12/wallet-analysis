import { supabase } from './supabaseClient.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const cdiService = {
  async syncCdi() {
    const response = await fetch(`${API_URL}/sync/cdi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Falha ao sincronizar CDI');
    return data;
  },

  async getCdiRange(startDate, endDate) {
    const { data, error } = await supabase
      .from('cdi_history')
      .select('trade_date, value')
      .gte('trade_date', startDate)
      .lte('trade_date', endDate)
      .order('trade_date', { ascending: true });

    if (error) throw error;
    return data;
  },
};
