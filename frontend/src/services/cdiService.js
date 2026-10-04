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
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    const response = await fetch(`${API_URL}/data/cdi?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Falha ao buscar CDI');
    return data;
  },
};
