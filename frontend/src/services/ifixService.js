const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function getIfixByDate(date) {
  const response = await fetch(`${API_URL}/data/ifix?date=${encodeURIComponent(date)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Falha ao buscar IFIX');
  return data[0]?.close_value ?? null;
}

export async function getIfixRange(startDate, endDate) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  const response = await fetch(`${API_URL}/data/ifix?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Falha ao buscar IFIX');
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
