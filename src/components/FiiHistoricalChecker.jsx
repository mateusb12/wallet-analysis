import React, { useState, useEffect, useRef } from 'react';
// 1. Importa fetchFiiDividends e remove fetchB3Prices
import { fetchFiiDividends, fetchUniqueTickers } from "../services/b3service";
import Pagination from './Pagination';

function FiiHistoricalChecker() {
    // States (sem mudanças)
    const [ticker, setTicker] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchedTicker, setSearchedTicker] = useState('');
    const [tickerList, setTickerList] = useState([]);
    const [tickersLoading, setTickersLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Refs (sem mudanças)
    const inputRef = useRef(null);
    const comboboxRef = useRef(null);

    // 2. loadPage agora usa fetchFiiDividends
    const loadPage = async (pageToLoad, tickerToSearch = null) => {
        setLoading(true);
        setError(null);
        const tickerToFetch = tickerToSearch || searchedTicker;
        if (!tickerToFetch) {
            setLoading(false);
            return;
        }
        try {
            // AQUI ESTÁ A MUDANÇA PRINCIPAL
            const { data, count } = await fetchFiiDividends(tickerToFetch, pageToLoad, pageSize);

            setData(data);
            setTotal(count);
            if (tickerToSearch) {
                setSearchedTicker(tickerToSearch);
            }
        } catch (err) {
            console.error(err);
            // Mensagem de erro atualizada
            setError('Erro ao buscar dividendos no Supabase.');
            setData([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    // useEffect para carregar tickers (sem mudanças)
    useEffect(() => {
        async function loadTickers() {
            setTickersLoading(true);
            setError(null);
            try {
                const tickers = await fetchUniqueTickers();
                setTickerList(tickers);
                const defaultTicker = tickers.includes('BPFF11') ? 'BPFF11' : (tickers[0] || '');
                if (defaultTicker) {
                    setTicker(defaultTicker);
                    loadPage(1, defaultTicker);
                }
            } catch (err) {
                console.error("Falha ao carregar tickers", err);
                setError('Erro ao carregar a lista de tickers.');
            } finally {
                setTickersLoading(false);
            }
        }
        loadTickers();
    }, []);

    // useEffect para paginação (sem mudanças)
    useEffect(() => {
        if (searchedTicker && page > 1) {
            loadPage(page);
        }
    }, [page]);

    // handleSearch (sem mudanças)
    const handleSearch = (e) => {
        e.preventDefault();
        if (ticker) {
            setPage(1);
            loadPage(1, ticker);
            setIsDropdownOpen(false);
        }
    };

    // totalPages & handlePageChange (sem mudanças)
    const totalPages = Math.ceil(total / pageSize);
    const handlePageChange = (newPage) => {
        setPage(newPage);
    };

    // filteredTickers (sem mudanças)
    const filteredTickers = tickerList.filter(t =>
        t.toLowerCase().includes(ticker.toLowerCase())
    );

    // handleBlur (sem mudanças)
    const handleBlur = (e) => {
        if (comboboxRef.current && !comboboxRef.current.contains(e.relatedTarget)) {
            setIsDropdownOpen(false);
        }
    };

    return (
        <div className="p-8">
            {/* --- TÍTULO --- */}
            <h2 className="text-3xl font-bold mb-6 text-gray-800">
                Histórico de Dividendos de FIIs
            </h2>

            {/* --- FORMULÁRIO DE BUSCA --- */}
            <div className="border border-gray-500 bg-white rounded-lg shadow-md p-6 max-w-2xl">
                <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ticker do FII
                        </label>
                        <div
                            className="relative"
                            ref={comboboxRef}
                            onBlur={handleBlur}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={ticker}
                                onChange={(e) => {
                                    setTicker(e.target.value);
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                disabled={tickersLoading || loading}
                                placeholder="Digite ou selecione um ticker"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white pr-10"
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                disabled={tickersLoading || loading}
                                onClick={() => {
                                    setIsDropdownOpen((state) => !state);
                                    inputRef.current.focus();
                                }}
                                className="absolute inset-y-0 right-0 flex items-center justify-center w-10 h-full text-gray-500 hover:text-gray-700"
                            >
                                <svg
                                    className="w-5 h-5"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {tickersLoading ? (
                                        <div className="px-4 py-2 text-gray-500">
                                            Carregando tickers...
                                        </div>
                                    ) : filteredTickers.length > 0 ? (
                                        filteredTickers.map((t) => (
                                            <div
                                                key={t}
                                                className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setTicker(t);
                                                    setIsDropdownOpen(false);
                                                    inputRef.current.focus();
                                                }}
                                            >
                                                {t}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-2 text-gray-500">
                                            Nenhum ticker encontrado.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || tickersLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    >
                        {loading ? "Buscando..." : "Buscar Dividendos"}
                    </button>
                </form>
            </div>

            {/* --- ÁREA DE RESULTADOS --- */}
            <div className="mt-8 max-w-6xl space-y-6">
                {loading && data.length === 0 && (
                    <p className="text-gray-500">Carregando...</p>
                )}
                {error && <p className="mt-6 text-red-500">{error}</p>}

                {!error && (data.length > 0 || !loading) && (
                    <div className="border border-gray-300 bg-white rounded-lg shadow-lg p-6">
                        {data.length > 0 ? (
                            <>
                                <p className="text-gray-700 text-sm mb-4">
                                    Exibindo página {page} de {totalPages} (
                                    {total} registros para{" "}
                                    <strong>{searchedTicker}</strong>)
                                </p>
                                <div
                                    className={`overflow-x-auto transition-opacity duration-300 ${
                                        loading ? "opacity-50" : "opacity-100"
                                    }`}
                                >
                                    <table className="w-full border-collapse border border-gray-300 text-sm">
                                        <thead className="bg-gray-100">
                                        <tr>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Data</th>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Ticker</th>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Abertura (R$)</th>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Fechamento (R$)</th>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Yield (%)</th>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Dividendo (R$)</th>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Volume</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {data.map((row) => (
                                            <tr
                                                key={`${row.ticker}-${row.trade_date}`}
                                                className="hover:bg-gray-50"
                                            >
                                                <td className="border px-2 py-1">{row.trade_date}</td>
                                                <td className="border px-2 py-1 font-semibold">{row.ticker}</td>
                                                <td className="border px-2 py-1">
                                                    {parseFloat(row.open).toFixed(2)}
                                                </td>
                                                <td className="border px-2 py-1">
                                                    {parseFloat(row.price_close).toFixed(2)}
                                                </td>
                                                <td className="border px-2 py-1 text-blue-600">
                                                    {(parseFloat(row.dividend_yield_month) * 100).toFixed(2)}%
                                                </td>
                                                <td className="border px-2 py-1 text-green-700 font-medium">
                                                    {parseFloat(row.dividend_value).toFixed(4)}
                                                </td>
                                                <td className="border px-2 py-1">
                                                    {Math.round(parseFloat(row.volume)).toLocaleString("pt-BR")}
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-6">
                                    <Pagination
                                        currentPage={page}
                                        totalPages={totalPages}
                                        onPageChange={handlePageChange}
                                    />
                                </div>
                            </>
                        ) : (
                            !loading &&
                            searchedTicker && (
                                <p className="text-gray-600">
                                    Nenhum dividendo encontrado para o ticker "
                                    {searchedTicker}".
                                </p>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default FiiHistoricalChecker;