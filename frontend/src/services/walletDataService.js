import { fetchFiiChartData, fetchB3Prices } from './b3service.js';
import { getIfixRange } from './ifixService.js';
import { getIbovRange } from './ibovService.js';
import { supabase } from './supabaseClient.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

let cachedPositions = null;

// --- HELPERS ---

const normalizeDate = (dateInput) => {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') return dateInput.substring(0, 10);
  if (dateInput instanceof Date) return dateInput.toISOString().substring(0, 10);
  return null;
};

const getPriceFromRecord = (record) => {
  if (!record) return 0;
  const val =
    record.close ||
    record.price_close ||
    record.close_value ||
    record.value ||
    record.purchase_price;
  return val ? parseFloat(val) : 0;
};

// Helper para pegar o Token JWT e montar o Header de Autorização
async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) throw new Error('Usuário não autenticado (Sessão expirada)');

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// --- CRUD WRAPPERS ---

// --- [NOVO] Função para o Dashboard ---
export const fetchDashboardData = async () => {
  const headers = await getAuthHeaders();

  // Note que removemos o ?user_id= da URL
  const response = await fetch(`${API_BASE}/wallet/dashboard`, {
    method: 'GET',
    headers: headers,
  });

  if (!response.ok) {
    // Se der 401, o throw vai capturar
    const err = await response.json();
    throw new Error(err.detail || 'Falha ao carregar dashboard');
  }

  return await response.json();
};

export const getWalletPurchases = async () => {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/wallet/purchases`, {
    method: 'GET',
    headers: headers,
  });

  if (!response.ok) throw new Error('Falha ao buscar histórico');
  return await response.json();
};

export const createPurchase = async (payload) => {
  const headers = await getAuthHeaders();

  const { user_id, ...cleanPayload } = payload;

  const response = await fetch(`${API_BASE}/wallet/purchases`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(cleanPayload),
  });

  if (!response.ok) throw new Error('Erro ao criar aporte');
  cachedPositions = null;
  return await response.json();
};

export const updatePurchase = async (id, payload) => {
  const headers = await getAuthHeaders();
  const { user_id, ...cleanPayload } = payload;

  const response = await fetch(`${API_BASE}/wallet/purchases/${id}`, {
    method: 'PUT',
    headers: headers,
    body: JSON.stringify(cleanPayload),
  });

  if (!response.ok) throw new Error('Erro ao atualizar');
  cachedPositions = null;
  return await response.json();
};

export const deletePurchase = async (id) => {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/wallet/purchases/${id}`, {
    method: 'DELETE',
    headers: headers,
  });

  if (!response.ok) throw new Error('Erro ao excluir');
  cachedPositions = null;
  return true;
};

export const importPurchases = async (payload) => {
  const headers = await getAuthHeaders();

  const body = {
    purchases: payload.purchases || payload,
  };

  const response = await fetch(`${API_BASE}/wallet/import`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Erro na importação');
  cachedPositions = null;
  return data;
};

export const fetchWalletPositions = async (forceRefresh = false) => {
  if (cachedPositions && !forceRefresh) return cachedPositions;

  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/wallet/purchases`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) throw new Error('Failed fetch');
    const data = await response.json();

    cachedPositions = data.map((item) => ({
      ticker: item.ticker,
      name: item.name || item.ticker,
      qty: item.qty,
      purchase_price: item.price,
      type: item.type,
      purchaseDate: item.trade_date,
      total_value: parseFloat((item.qty * item.price).toFixed(2)),
      current_price: item.price,
      total_value_current: parseFloat((item.qty * item.price).toFixed(2)),
    }));
    return cachedPositions;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const fetchWalletPerformanceHistory = async () => {
  const debugInfo = { url: '', status: 0, rawResponse: null, error: null };

  try {
    const headers = await getAuthHeaders();
    const url = `${API_BASE}/wallet/performance/history`;

    debugInfo.url = url;

    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
    });

    debugInfo.status = response.status;

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    debugInfo.rawResponse = data;

    return {
      total: data,
      stock: [],
      etf: [],
      fii: [],
      warnings: [],
      debug: debugInfo,
    };
  } catch (error) {
    console.error('Falha ao buscar histórico consolidado:', error);
    debugInfo.error = error.toString();
    return {
      stock: [],
      etf: [],
      fii: [],
      total: [],
      warnings: ['Falha de conexão ou Autenticação'],
      debug: debugInfo,
    };
  }
};

// --- MANTIDO: LÓGICA PARA ATIVO ESPECÍFICO (Dropdown) ---

const fetchBenchmarkData = async (type, startDate, endDate) => {
  try {
    let result = [];
    if (type === 'fii') result = await getIfixRange(startDate, endDate);
    else if (type === 'stock') result = await getIbovRange(startDate, endDate);
    else {
      let tickerIndex = type === 'etf' ? 'IVVB11' : '^BVSP';
      const { data } = await fetchB3Prices(tickerIndex, 1, 365 * 5);
      if (data) {
        result = data
          .filter((d) => d.trade_date >= startDate && d.trade_date <= endDate)
          .map((d) => ({ trade_date: d.trade_date, close_value: d.close }))
          .sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
      }
    }
    return result;
  } catch (err) {
    return [];
  }
};

const calculateBenchmarkCurve = (portfolioCurve, benchmarkHistory, isRate = false) => {
  if (!portfolioCurve || portfolioCurve.length === 0) return [];
  const indexMap = {};
  if (benchmarkHistory && Array.isArray(benchmarkHistory)) {
    benchmarkHistory.forEach((item) => {
      const val = parseFloat(item.close_value || item.close || item.value || 0);
      if (!isNaN(val) && item.trade_date) indexMap[normalizeDate(item.trade_date)] = val;
    });
  }

  const availableDates = Object.keys(indexMap).sort();
  const getClosestIndexValue = (targetDate) => {
    if (indexMap[targetDate] !== undefined) return indexMap[targetDate];
    let closest = availableDates.find((d) => d > targetDate) || availableDates[0];
    return closest ? indexMap[closest] : null;
  };

  let accumulatedBenchmarkCapital = 0;
  let lastKnownIndexValue = null;

  return portfolioCurve.map((day, index) => {
    const dateKey = normalizeDate(day.trade_date);
    const currentIndexValue = getClosestIndexValue(dateKey);
    const currentInvested = day.invested_amount;
    const benchmarkRaw = currentIndexValue !== null ? currentIndexValue : 0;

    if (index === 0) {
      accumulatedBenchmarkCapital = day.portfolio_value;
      if (currentIndexValue > 0) lastKnownIndexValue = currentIndexValue;
      return {
        ...day,
        benchmark_value: parseFloat(accumulatedBenchmarkCapital.toFixed(2)),
        benchmark_raw: benchmarkRaw,
      };
    }

    const previousInvested = portfolioCurve[index - 1].invested_amount;
    const netDeposit = currentInvested - previousInvested;

    if (lastKnownIndexValue > 0 && currentIndexValue > 0) {
      let dailyFactor = isRate
        ? 1 + currentIndexValue / 100
        : currentIndexValue / lastKnownIndexValue;
      accumulatedBenchmarkCapital = accumulatedBenchmarkCapital * dailyFactor;
    }
    if (netDeposit !== 0) accumulatedBenchmarkCapital += netDeposit;
    if (currentIndexValue > 0) lastKnownIndexValue = currentIndexValue;

    return {
      ...day,
      benchmark_value: parseFloat(accumulatedBenchmarkCapital.toFixed(2)),
      benchmark_raw: benchmarkRaw,
    };
  });
};

export const fetchSpecificAssetHistory = async (ticker, months = 60) => {
  const positions = await fetchWalletPositions();
  const asset = positions.find((a) => a.ticker === ticker);
  if (!asset) return [];

  const data = await fetchFiiChartData(asset.ticker, 60);
  if (!data || data.length === 0) return [];

  const purchaseDate = normalizeDate(asset.purchaseDate);
  const sortedData = data.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
  const filteredData = sortedData.filter((d) => normalizeDate(d.trade_date) >= purchaseDate);

  if (filteredData.length === 0) return [];

  const benchmarkData = await fetchBenchmarkData(
    asset.type,
    filteredData[0].trade_date,
    filteredData[filteredData.length - 1].trade_date
  );

  const assetCurve = filteredData.map((day) => {
    const price = parseFloat(day.adjusted_close || 0) || getPriceFromRecord(day);
    return {
      trade_date: day.trade_date,
      portfolio_value: parseFloat((asset.qty * price).toFixed(2)),
      invested_amount: parseFloat(asset.total_value.toFixed(2)),
      asset_price_raw: price,
    };
  });

  return calculateBenchmarkCurve(assetCurve, benchmarkData, false);
};
