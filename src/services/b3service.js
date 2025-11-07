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
