import { supabase } from './supabaseClient.js';

export async function fetchB3Prices(ticker, page = 1, pageSize = 50) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('b3_prices')
    .select('*', { count: 'exact' })
    .eq('ticker', ticker.toUpperCase())
    .order('trade_date', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data, count };
}

export async function fetchUniqueTickers() {
  const { data, error } = await supabase.from('unique_tickers_view').select('ticker');

  if (error) {
    console.error("Erro ao buscar tickers únicos. Você criou a 'unique_tickers_view' no Supabase?");
    throw error;
  }

  return data.map((item) => item.ticker);
}

export async function fetchFiiDividends(ticker = null, page = 1, pageSize = 50) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('b3_fiis_dividends')
    .select('*', { count: 'exact' })
    .gt('dividend_value', 0)
    .order('trade_date', { ascending: false })
    .range(from, to);

  if (ticker) {
    query = query.eq('ticker', ticker.toUpperCase());
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('Erro ao buscar dividendos de FIIs:', error.message);
    throw error;
  }

  return { data, count };
}

export async function fetchFiiDateRange(ticker) {
  const { data, error } = await supabase
    .from('fii_date_ranges_view')
    .select('oldest_date, newest_date')
    .eq('ticker', ticker.toUpperCase())
    .single();

  if (error) {
    console.error(`Erro ao buscar range de datas para ${ticker}:`, error.message);
    if (error.code === 'PGRST116') {
      throw new Error(`Nenhum dado histórico encontrado para o ticker ${ticker}.`);
    }
    throw error;
  }

  return data;
}

export async function fetchFiiDividendForMonth(ticker, month, year) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('b3_fiis_dividends')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .gt('dividend_value', 0)
    .gte('trade_date', startDate)
    .lte('trade_date', endDate)
    .order('trade_date', { ascending: true })
    .limit(1);

  if (error) {
    console.error(`Erro ao buscar dividendo para ${ticker} em ${month}/${year}:`, error.message);
    throw error;
  }

  return data && data.length > 0 ? data[0] : null;
}

export async function fetchFirstEverPrice(ticker, oldestDate) {
  const { data, error } = await supabase
    .from('b3_fiis_dividends')
    .select('price_close')
    .eq('ticker', ticker.toUpperCase())
    .gte('trade_date', oldestDate)
    .order('trade_date', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    console.error('Erro ao buscar primeiro preço histórico:', error.message);
    throw error;
  }

  return data;
}
