// src/services/b3Service.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Busca registros da tabela b3_prices com filtro e paginação
 * @param {string} ticker - Ex: 'HGLG11'
 * @param {number} page - Página atual (1-based)
 * @param {number} pageSize - Número de registros por página
 * @returns {Promise<{data: any[], count: number}>}
 */
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

/**
 * --- NOVO ---
 * Busca tickers únicos da tabela b3_prices.
 *
 * NOTA: Isso funciona criando uma "View" no Supabase.
 * Execute este comando SQL UMA VEZ no seu "SQL Editor" do Supabase:
 *
 * CREATE VIEW unique_tickers_view AS
 * SELECT DISTINCT ticker
 * FROM b3_prices
 * ORDER BY ticker;
 *
 * @returns {Promise<string[]>} - Um array de strings (tickers)
 */
export async function fetchUniqueTickers() {
    // Agora consultamos a "View" que criamos
    const { data, error } = await supabase
        .from('unique_tickers_view')
        .select('ticker');

    if (error) {
        console.error("Erro ao buscar tickers únicos. Você criou a 'unique_tickers_view' no Supabase?");
        throw error;
    }

    // Transforma o array de objetos [{ticker: 'X'}, {ticker: 'Y'}]
    // em um array de strings ['X', 'Y']
    return data.map(item => item.ticker);
}

/**
 * --- NOVO ---
 * Busca dividendos de FIIs (apenas linhas com dividend_value > 0)
 * da view `b3_fiis_dividends`.
 *
 * @param {string} [ticker] - Opcional: filtra por ticker específico (ex: 'HGLG11')
 * @param {number} [page=1]
 * @param {number} [pageSize=50]
 * @returns {Promise<{data: any[], count: number}>}
 */
export async function fetchFiiDividends(ticker = null, page = 1, pageSize = 50) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('b3_fiis_dividends')
        .select('*', { count: 'exact' })
        // --- ESTA É A LINHA QUE FALTAVA ---
        // Filtra para mostrar apenas pagamentos reais
        .gt('dividend_value', 0)
        // ------------------------------------
        .order('trade_date', { ascending: false })
        .range(from, to);

    if (ticker) {
        query = query.eq('ticker', ticker.toUpperCase());
    }

    const { data, error, count } = await query;
    if (error) {
        console.error("Erro ao buscar dividendos de FIIs:", error.message);
        throw error;
    }

    return { data, count };
}

/**
 * --- NOVO ---
 * Busca o range de datas (primeira e última) com dividendos
 * para um FII específico.
 *
 * @param {string} ticker - Ticker (ex: 'HGLG11')
 * @returns {Promise<{oldest_date: string, newest_date: string} | null>}
 */
export async function fetchFiiDateRange(ticker) {
    const { data, error } = await supabase
        .from('fii_date_ranges') // Consulta a nova VIEW
        .select('oldest_date, newest_date')
        .eq('ticker', ticker.toUpperCase())
        .single(); // Esperamos apenas um resultado

    if (error) {
        console.error(`Erro ao buscar range de datas para ${ticker}:`, error.message);
        if (error.code === 'PGRST116') {
            // "PGRST116" = "The result contains 0 rows"
            throw new Error(`Nenhum dado histórico encontrado para o ticker ${ticker}.`);
        }
        throw error;
    }

    return data;
}

/**
 * Busca o primeiro registro de dividendo (dividend_value > 0)
 * para um ticker em um mês e ano específicos.
 * (Função do passo anterior, sem mudanças)
 */
export async function fetchFiiDividendForMonth(ticker, month, year) {
    // ... (código da função sem mudanças) ...
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