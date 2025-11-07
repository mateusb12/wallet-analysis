// src/components/FiiHistoricalChecker.jsx
import React, { useState, useEffect } from 'react';
import {fetchB3Prices} from "../services/b3service.js";

function FiiHistoricalChecker() {
    const [ticker, setTicker] = useState('BPFF11');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadPage = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, count } = await fetchB3Prices(ticker, page, pageSize);
            setData(data);
            setTotal(count);
        } catch (err) {
            console.error(err);
            setError('Erro ao buscar dados no Supabase.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPage();
    }, [ticker, page]);

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="p-8">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">
                Histórico de FII (Supabase)
            </h2>

            <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ticker do FII (ex: BPFF11)
                        </label>
                        <input
                            type="text"
                            value={ticker}
                            onChange={(e) => {
                                setPage(1);
                                setTicker(e.target.value.toUpperCase());
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {loading && <p className="mt-6 text-gray-500">Carregando...</p>}
                {error && <p className="mt-6 text-red-500">{error}</p>}

                {!loading && !error && (
                    <>
                        <div className="mt-6">
                            <p className="text-gray-700 text-sm mb-2">
                                Exibindo página {page} de {totalPages} ({total} registros)
                            </p>

                            <table className="w-full border-collapse border border-gray-300 text-sm">
                                <thead className="bg-gray-100">
                                <tr>
                                    <th className="border border-gray-300 px-2 py-1">Data</th>
                                    <th className="border border-gray-300 px-2 py-1">Abertura</th>
                                    <th className="border border-gray-300 px-2 py-1">Fechamento</th>
                                    <th className="border border-gray-300 px-2 py-1">Volume</th>
                                </tr>
                                </thead>
                                <tbody>
                                {data.map((row) => (
                                    <tr key={`${row.ticker}-${row.trade_date}`}>
                                        <td className="border px-2 py-1">{row.trade_date}</td>
                                        <td className="border px-2 py-1">{row.open}</td>
                                        <td className="border px-2 py-1">{row.close}</td>
                                        <td className="border px-2 py-1">{row.volume}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>

                            {/* Paginação */}
                            <div className="mt-4 flex justify-between">
                                <button
                                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                    disabled={page <= 1}
                                    className="bg-gray-200 px-3 py-1 rounded disabled:opacity-50"
                                >
                                    ← Anterior
                                </button>
                                <button
                                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                                    disabled={page >= totalPages}
                                    className="bg-gray-200 px-3 py-1 rounded disabled:opacity-50"
                                >
                                    Próxima →
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default FiiHistoricalChecker;
