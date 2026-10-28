const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Falha ao buscar dados da B3');
  return data;
}

export async function fetchB3Prices(ticker, page = 1, pageSize = 50) {
  return request(
    `/data/b3/prices?ticker=${encodeURIComponent(ticker.toUpperCase())}&page=${page}&page_size=${pageSize}`
  );
}

export async function fetchUniqueStockTickers() {
  return request('/data/b3/stocks');
}

export async function fetchFullStockHistory(ticker) {
  const data = await request(`/data/b3/stocks/${encodeURIComponent(ticker.toUpperCase())}/history`);
  return data.map((item) => {
    const value = item.adjusted_close && item.adjusted_close > 0 ? item.adjusted_close : item.close;
    return {
      date: new Date(item.trade_date).getTime(),
      dateStr: item.trade_date,
      close: parseFloat(value),
    };
  });
}

export async function fetchUniqueTickers() {
  return request('/data/b3/tickers');
}

export async function fetchFiiDividends(ticker = null, page = 1, pageSize = 50) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (ticker) params.set('ticker', ticker.toUpperCase());
  return request(`/data/b3/fiis/dividends?${params}`);
}

export async function fetchFiiChartData(ticker, months) {
  const params = new URLSearchParams();
  if (months > 0) {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    params.set('start_date', date.toISOString().split('T')[0]);
  }
  const query = params.toString();
  return request(`/data/b3/fiis/${encodeURIComponent(ticker.toUpperCase())}/chart${query ? `?${query}` : ''}`);
}

export async function fetchFiiDateRange(ticker) {
  return request(`/data/b3/fiis/${encodeURIComponent(ticker.toUpperCase())}/date-range`);
}

export async function fetchFiiDividendForMonth(ticker, month, year) {
  return request(
    `/data/b3/fiis/${encodeURIComponent(ticker.toUpperCase())}/dividend?month=${month}&year=${year}`
  );
}

export async function fetchFirstEverPrice(ticker, oldestDate) {
  return request(
    `/data/b3/fiis/${encodeURIComponent(ticker.toUpperCase())}/first-price?oldest_date=${encodeURIComponent(oldestDate)}`
  );
}

export async function syncTickerHistory(ticker) {
  try {
    return await request('/sync/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });
  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, error: error.message || 'Falha ao sincronizar ticker' };
  }
}

export async function fetchPriceClosestToDate(ticker, targetDate) {
  const data = await request(
    `/data/b3/prices/closest?ticker=${encodeURIComponent(ticker.toUpperCase())}&target_date=${encodeURIComponent(targetDate)}`
  );
  if (!data) return null;

  const value = data.adjusted_close && data.adjusted_close > 0 ? data.adjusted_close : data.close;
  return parseFloat(value);
}
