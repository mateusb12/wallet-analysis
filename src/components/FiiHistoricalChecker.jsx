import React, { useState, useEffect } from 'react';
import { fetchB3Prices } from "../services/b3service.js";
// 1. Importar o novo componente de paginação
import Pagination from './Pagination';

function FiiHistoricalChecker() {
    const [ticker, setTicker] = useState('BPFF11');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchedTicker, setSearchedTicker] = useState(ticker);

    const loadPage = async (pageToLoad) => { // Aceita a página como argumento
        setLoading(true);
        setError(null);
        // Não precisamos mais salvar o searchedTicker aqui
        try {
            const { data, count } = await fetchB3Prices(ticker, pageToLoad, pageSize);
            setData(data);
            setTotal(count);
        } catch (err) {
            console.error(err);
            setError('Erro ao buscar dados no Supabase.');
        } finally {
            setLoading(false);
        }
    };

    // Este useEffect agora só reage a 'page'
    useEffect(() => {
        // Só carrega se já tiver um ticker buscado
        if (searchedTicker) {
            loadPage(page);
        }
    }, [page]); // Removido 'searchedTicker' daqui

    const handleSearch = (e) => {
        e.preventDefault();
        setSearchedTicker(ticker); // Salva o ticker que estamos buscando
        setPage(1); // Reseta a página
        loadPage(1); // Inicia a busca com a página 1
    };

    // Este useEffect agora reage ao 'searchedTicker'
    // E é usado APENAS para a busca inicial
    // (Esta é uma forma alternativa de lidar com a busca,
    // mas o `handleSearch` já resolve. Podemos simplificar
    // e remover o useEffect que dependia de 'searchedTicker')

    /* Simplificação:
       Vamos remover o useEffect que depende de 'searchedTicker'
       e deixar o 'handleSearch' ser o único gatilho de *novas* buscas.
       O useEffect que depende de 'page' vai lidar com a *mudança* de páginas.
    */

    // NOVO useEffect - Roda UMA VEZ no load inicial
    useEffect(() => {
        loadPage(1);
    }, []); // Array vazio, roda só no mount

    const totalPages = Math.ceil(total / pageSize);

    // Função para passar para o componente de Paginação
    // Isso garante que o estado 'page' seja atualizado
    const handlePageChange = (newPage) => {
        setPage(newPage);
    };

    return (
        <div className="p-8">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">
                Histórico de FII (Supabase)
            </h2>

            {/* --- CARD DE INPUTS --- */}
            <div className="border border-gray-500 bg-white rounded-lg shadow-md p-6 max-w-2xl">
                <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ticker do FII (ex: BPFF11)
                        </label>
                        <input
                            type="text"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading && page === 1} // Só desabilita se estiver carregando a pág 1
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    >
                        {loading && page === 1 ? "Buscando..." : "Buscar Histórico"}
                    </button>
                </form>
            </div>

            {/* --- ÁREA DE RESULTADOS --- */}
            <div className="mt-8 max-w-2xl space-y-6">
                {/* Mostra "Carregando" apenas se for a primeira vez ou se a busca for nova */}
                {loading && data.length === 0 && <p className="text-gray-500">Carregando...</p>}
                {error && <p className="mt-6 text-red-500">{error}</p>}

                {/* Card de Resultados */}
                {/* Mostra se não tiver erro E (tiver dados OU não estiver carregando) */}
                {!error && (data.length > 0 || !loading) && (
                    <div className="border border-gray-300 bg-white rounded-lg shadow-lg p-6">
                        {data.length > 0 ? (
                            <>
                                <p className="text-gray-700 text-sm mb-4">
                                    Exibindo página {page} de {totalPages} ({total} registros para <strong>{searchedTicker}</strong>)
                                </p>

                                {/* Opacidade na tabela durante o carregamento de novas páginas */}
                                <div className={`overflow-x-auto transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                                    <table className="w-full border-collapse border border-gray-300 text-sm">
                                        {/* ... (thead e tbody da tabela - sem mudanças) ... */}
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


                                {/* 2. SUBSTITUIR a div de paginação antiga por esta */}
                                <div className="mt-6">
                                    <Pagination
                                        currentPage={page}
                                        totalPages={totalPages}
                                        onPageChange={handlePageChange}
                                    />
                                </div>
                            </>
                        ) : (
                            // Mensagem para quando a busca não retorna nada (e não está carregando)
                            !loading && (
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