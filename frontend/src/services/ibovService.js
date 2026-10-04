const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function getIbovRange(startDate, endDate) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  const response = await fetch(`${API_URL}/data/ibov?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Falha ao buscar IBOV');
  return data;
}

export async function getLastIbovDate() {
  const response = await fetch(`${API_URL}/data/ibov/last`);
  const data = await response.json();
  if (!response.ok) return null;
  return data.trade_date ?? null;
}
