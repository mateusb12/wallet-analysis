import React, { useState, useEffect, useRef } from 'react'; // 1. Importar useRef
import { fetchB3Prices, fetchUniqueTickers } from "../services/b3service";
import Pagination from './Pagination';

function FiiHistoricalChecker() {
    // States 1-5 (sem mudanças)
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

    // State 9 (sem mudanças)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // 12. Refs para o input e para o container do combobox
    const inputRef = useRef(null);
    const comboboxRef = useRef(null); // Ref para o container

    // useEffects 6 e 7 (sem mudanças)
    const loadPage = async (pageToLoad, tickerToSearch = null) => {
        setLoading(true);
        setError(null);
        const tickerToFetch = tickerToSearch || searchedTicker;
        if (!tickerToFetch) {
            setLoading(false);
            return;
        }
        try {
            const { data, count } = await fetchB3Prices(tickerToFetch, pageToLoad, pageSize);
            setData(data);
            setTotal(count);
            if (tickerToSearch) {
                setSearchedTicker(tickerToSearch);
            }
        } catch (err) {
            console.error(err);
            setError('Erro ao buscar dados no Supabase.');
            setData([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };
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

    // State 10 (sem mudanças)
    const filteredTickers = tickerList.filter(t =>
        t.toLowerCase().includes(ticker.toLowerCase())
    );

    // 13. Handler de onBlur para o container
    // Fecha o dropdown se o foco sair do componente
    const handleBlur = (e) => {
        if (comboboxRef.current && !comboboxRef.current.contains(e.relatedTarget)) {
            setIsDropdownOpen(false);
        }
    };

    return (
        <div className="p-8">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">
                Histórico de FII (Supabase)
            </h2>

            <div className="border border-gray-500 bg-white rounded-lg shadow-md p-6 max-w-2xl">
                <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ticker do FII
                        </label>

                        {/* 14. O container do combobox com o ref e onBlur */}
                        <div
                            className="relative"
                            ref={comboboxRef}
                            onBlur={handleBlur} // Adiciona o handler de blur aqui
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={ticker}
                                onChange={(e) => {
                                    setTicker(e.target.value);
                                    setIsDropdownOpen(true); // Abrir ao digitar
                                }}
                                onFocus={() => setIsDropdownOpen(true)} // Abrir ao focar
                                // onBlur foi movido para o container
                                disabled={tickersLoading || loading}
                                placeholder="Digite ou selecione um ticker"
                                // Adiciona padding à direita para não sobrepor o texto ao botão
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white pr-10"
                                autoComplete="off"
                            />

                            {/* 15. ESTE É O NOVO BOTÃO DE DROPDOWN */}
                            <button
                                type="button" // Prevenir submit de form
                                disabled={tickersLoading || loading}
                                onClick={() => {
                                    // Alterna o dropdown e foca no input
                                    setIsDropdownOpen(state => !state);
                                    inputRef.current.focus();
                                }}
                                // Posicionamento absoluto sobre o input
                                className="absolute inset-y-0 right-0 flex items-center justify-center w-10 h-full text-gray-500 hover:text-gray-700"
                            >
                                {/* Ícone de seta (tailwind heroicon) */}
                                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>

                            {/* 16. Lista de resultados (dropdown) */}
                            {isDropdownOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {tickersLoading ? (
                                        <div className="px-4 py-2 text-gray-500">Carregando tickers...</div>
                                    ) : filteredTickers.length > 0 ? (
                                        filteredTickers.map(t => (
                                            <div
                                                key={t}
                                                className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                                                // 17. Usar onMouseDown para selecionar
                                                // previne que o 'onBlur' feche o menu antes do clique
                                                onMouseDown={(e) => {
                                                    e.preventDefault(); // Previne o 'blur'
                                                    setTicker(t);
                                                    setIsDropdownOpen(false);
                                                    inputRef.current.focus();
                                                }}
                                            >
                                                {t}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-2 text-gray-500">Nenhum ticker encontrado.</div>
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
                        {loading ? "Buscando..." : "Buscar Histórico"}
                    </button>
                </form>
            </div>

            {/* --- ÁREA DE RESULTADOS (sem mudanças) --- */}
            <div className="mt-8 max-w-2xl space-y-6">
                {/* ... (resto do código igual) ... */}
                {loading && data.length === 0 && <p className="text-gray-500">Carregando...</p>}
                {error && <p className="mt-6 text-red-500">{error}</p>}

                {!error && (data.length > 0 || !loading) && (
                    <div className="border border-gray-300 bg-white rounded-lg shadow-lg p-6">
                        {data.length > 0 ? (
                            <>
                                <p className="text-gray-700 text-sm mb-4">
                                    Exibindo página {page} de {totalPages} ({total} registros para <strong>{searchedTicker}</strong>)
                                </p>
                                <div className={`overflow-x-auto transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                                    <table className="w-full border-collapse border border-gray-300 text-sm">
                                        <thead className="bg-gray-100">
                                        <tr>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Data</th>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Abertura</th>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Fechamento</th>
                                            <th className="border border-gray-300 px-2 py-1 text-left">Volume</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {data.map((row) => (
                                            <tr key={`${row.ticker}-${row.trade_date}`} className="hover:bg-gray-50">
                                                <td className="border px-2 py-1">{row.trade_date}</td>
                                                <td className="border px-2 py-1">{row.open}</td>
                                                <td className="border px-2 py-1">{row.close}</td>
                                                <td className="border px-2 py-1">{row.volume}</td>
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
                            !loading && searchedTicker && (
                                <p className="text-gray-600">
                                    Nenhum dado encontrado para o ticker "{searchedTicker}".
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