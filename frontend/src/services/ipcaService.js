const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function getIpcaForMonth(year, month) {
  const refDate = `${year}-${String(month).padStart(2, '0')}-01`;

  const response = await fetch(`${API_URL}/data/ipca?ref_date=${encodeURIComponent(refDate)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Falha ao buscar IPCA');
  return data[0]?.ipca ?? null;
}

export async function getIpcaRange(startYear, startMonth, endYear, endMonth) {
  const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  const response = await fetch(`${API_URL}/data/ipca?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Falha ao buscar IPCA');
  return data;
}

export function calculateAccumulatedFactor(ipcaSeries) {
  return ipcaSeries.reduce((acc, row) => acc * (1 + row.ipca / 100), 1);
}

export function correctValue(initialValue, factor) {
  return initialValue * factor;
}

export async function syncIpcaHistory() {
  const response = await fetch(`${API_URL}/data/ipca/sync`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Falha ao sincronizar IPCA');
  return data;
}

export async function getLastIpcaDate() {
  const response = await fetch(`${API_URL}/data/ipca/last`);
  const data = await response.json();
  if (!response.ok) return null;
  return data.ref_date ?? null;
}
