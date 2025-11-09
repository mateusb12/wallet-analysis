// src/components/FiiSimulator.jsx
import React, { useState, useEffect, useRef } from 'react';
// 1. Importa a nova função de serviço
import { fetchFiiDividendForMonth, fetchUniqueTickers } from "../services/b3service";

// Helper para formatar moeda
const formatCurrency = (num) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(num);

// Helper para formatar data
const formatDate = (date) => {
    return new Intl.DateTimeFormat('pt-BR', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC' // Garante consistência
    }).format(date);
}

// Helper para adicionar meses a uma data
function addMonths(date, months) {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() + months);
    d.setUTCDate(Math.min(date.getUTCDate(), new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 0).getUTCDate()));
    return d;
}

// Helper para pegar o dia de hoje no formato YYYY-MM-DD
const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Mês é 0-11
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}


function FiiSimulator() {
    // --- States para o Formulário ---
    const [ticker, setTicker] = useState('');
    const [initialInvestment, setInitialInvestment] = useState('10000');
    const [monthlyDeposit, setMonthlyDeposit] = useState('500');

    // 2. MUDANÇA: Substituímos 'simulationMonths' por 'startDate'
    const [startDate, setStartDate] = useState('2023-01-01');
    const [endDate, setEndDate] = useState(getTodayDateString());


    // ... (States do ComboBox de Ticker não mudam) ...
    const [tickerList, setTickerList] = useState([]);
    const [tickersLoading, setTickersLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const inputRef = useRef(null);
    const comboboxRef = useRef(null);

    // ... (States de Resultado não mudam) ...
    const [simulationData, setSimulationData] = useState([]);
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- Carregar Tickers (sem mudanças) ---
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
                }
            } catch (err) { /* ... */ }
            finally { setTickersLoading(false); }
        }
        loadTickers();
    }, []);

    // --- 3. LÓGICA DA SIMULAÇÃO (TOTALMENTE REFEITA) ---
    const handleRunSimulation = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSimulationData([]);
        setSummaryData(null);

        try {
            const initialInv = parseFloat(initialInvestment) || 0;
            const monthlyDep = parseFloat(monthlyDeposit) || 0;

            // Converte as strings de data para objetos Date em UTC
            // Isso evita problemas de fuso horário
            const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
            const simStartDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));

            const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
            const simEndDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

            if (simStartDate >= simEndDate) {
                throw new Error("A data de início deve ser anterior à data de fim.");
            }

            // Inicializa variáveis da simulação
            let sharesReinvest = 0;
            let sharesNoReinvest = 0;
            let totalDividendsWithdrawn = 0;
            let totalInvested = 0;
            let simulationTable = [];
            let lastPrice = 0;

            // ----- Início do Investimento (Mês 0) -----

            // Busca o dado do primeiro mês (mês do aporte inicial)
            const firstMonthData = await fetchFiiDividendForMonth(ticker, simStartDate.getUTCMonth() + 1, simStartDate.getUTCFullYear());

            if (!firstMonthData) {
                throw new Error(`Nenhum dado de preço/dividendo encontrado para ${ticker} no mês de início (${formatDate(simStartDate)}).`);
            }

            lastPrice = parseFloat(firstMonthData.price_close);
            totalInvested = initialInv;

            // Compra inicial
            sharesReinvest = initialInv / lastPrice;
            sharesNoReinvest = initialInv / lastPrice;

            // Adiciona primeira linha (aporte inicial)
            simulationTable.push({
                month: formatDate(simStartDate),
                deposit: initialInv,
                reinvestStart: 0,
                reinvestDividends: 0,
                reinvestEnd: initialInv,
                noReinvestStart: 0,
                noReinvestDividends: 0,
                noReinvestEnd: initialInv,
                difference: 0,
            });

            // ----- Loop Mensal (A partir do Mês 1) -----

            let currentDate = addMonths(simStartDate, 1);

            while (currentDate <= simEndDate) {
                const currentMonth = currentDate.getUTCMonth() + 1; // 1-12
                const currentYear = currentDate.getUTCFullYear();

                // Busca os dados (preço/dividendo) para o mês atual
                const monthData = await fetchFiiDividendForMonth(ticker, currentMonth, currentYear);

                // Se não achar dados (ex: FII novo, fim de semana), usa o último preço conhecido
                const currentPrice = monthData ? parseFloat(monthData.price_close) : lastPrice;
                const dividendPerShare = monthData ? parseFloat(monthData.dividend_value) : 0;

                if (monthData) {
                    lastPrice = currentPrice; // Atualiza o último preço conhecido
                }

                totalInvested += monthlyDep;

                // Valores no início do mês (antes do aporte/dividendos)
                const startValueReinvest = sharesReinvest * currentPrice;
                const startValueNoReinvest = sharesNoReinvest * currentPrice;

                // Recebe dividendos (baseado nas cotas que JÁ TINHA)
                const dividendsReinvest = sharesReinvest * dividendPerShare;
                const dividendsNoReinvest = sharesNoReinvest * dividendPerShare;

                // --- Cenário 1: Reinvestindo ---
                const totalToBuyReinvest = monthlyDep + dividendsReinvest;
                const newSharesReinvest = totalToBuyReinvest / currentPrice;
                sharesReinvest += newSharesReinvest;

                // --- Cenário 2: Não Reinvestindo ---
                const newSharesNoReinvest = monthlyDep / currentPrice; // Compra só com o aporte
                sharesNoReinvest += newSharesNoReinvest;
                totalDividendsWithdrawn += dividendsNoReinvest; // Dividendos são "sacados"

                // Valores no fim do mês
                const endValueReinvest = sharesReinvest * currentPrice;
                const endValueNoReinvest = sharesNoReinvest * currentPrice;

                simulationTable.push({
                    month: formatDate(currentDate),
                    deposit: monthlyDep,
                    reinvestStart: startValueReinvest,
                    reinvestDividends: dividendsReinvest,
                    reinvestEnd: endValueReinvest,
                    noReinvestStart: startValueNoReinvest,
                    noReinvestDividends: dividendsNoReinvest,
                    noReinvestEnd: endValueNoReinvest,
                    difference: endValueReinvest - endValueNoReinvest,
                });

                // Avança para o próximo mês
                currentDate = addMonths(currentDate, 1);
            }

            // 4. Salvar resultados
            setSimulationData(simulationTable);

            // 5. Calcular Resumo Final
            const reinvestFinalValue = sharesReinvest * lastPrice;
            const noReinvestFinalValue = sharesNoReinvest * lastPrice;

            setSummaryData({
                totalInvested: totalInvested,
                reinvestFinalValue: reinvestFinalValue,
                reinvestTotalGain: reinvestFinalValue - totalInvested,
                noReinvestFinalValue: noReinvestFinalValue,
                totalDividendsWithdrawn: totalDividendsWithdrawn,
                noReinvestTotalGain: (noReinvestFinalValue + totalDividendsWithdrawn) - totalInvested,
            });

        } catch (err) {
            console.error(err);
            setError(err.message || 'Erro ao rodar a simulação.');
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers do ComboBox (sem mudanças) ---
    const handleBlur = (e) => {
        if (comboboxRef.current && !comboboxRef.current.contains(e.relatedTarget)) {
            setIsDropdownOpen(false);
        }
    };
    const filteredTickers = tickerList.filter(t =>
        t.toLowerCase().includes(ticker.toLowerCase())
    );

    // --- JSX ---
    return (
        <div className="p-8">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">
                Simulador de Investimento em FIIs
            </h2>

            {/* --- FORMULÁRIO DE INPUT --- */}
            <div className="border border-gray-500 bg-white rounded-lg shadow-md p-6 max-w-4xl mb-8">
                <form onSubmit={handleRunSimulation} className="space-y-4">

                    {/* --- Linha 1: Ticker --- */}
                    <div>
                        <label htmlFor="ticker-input" className="block text-sm font-medium text-gray-700 mb-2">
                            Ticker do FII
                        </label>
                        {/* ... (Todo o JSX do combobox de ticker não muda) ... */}
                        <div className="relative" ref={comboboxRef} onBlur={handleBlur}>
                            <input
                                ref={inputRef}
                                type="text"
                                id="ticker-input"
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
                            {/* ... (Botão e Dropdown do combobox) ... */}
                            <button type="button" disabled={tickersLoading || loading} onClick={() => { setIsDropdownOpen((state) => !state); inputRef.current.focus(); }} className="absolute inset-y-0 right-0 flex items-center justify-center w-10 h-full text-gray-500 hover:text-gray-700">
                                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                            {isDropdownOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {tickersLoading ? (
                                        <div className="px-4 py-2 text-gray-500">Carregando tickers...</div>
                                    ) : filteredTickers.length > 0 ? (
                                        filteredTickers.map((t) => (
                                            <div key={t} className="px-4 py-2 hover:bg-blue-100 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); setTicker(t); setIsDropdownOpen(false); inputRef.current.focus(); }}>
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

                    {/* --- 4. MUDANÇA: Inputs Financeiros e de Data --- */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label htmlFor="initial-inv" className="block text-sm font-medium text-gray-700 mb-2">
                                Invest. Inicial (R$)
                            </label>
                            <input
                                type="number"
                                id="initial-inv"
                                value={initialInvestment}
                                onChange={(e) => setInitialInvestment(e.target.value)}
                                disabled={loading}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="10000"
                            />
                        </div>
                        <div>
                            <label htmlFor="monthly-dep" className="block text-sm font-medium text-gray-700 mb-2">
                                Aporte Mensal (R$)
                            </label>
                            <input
                                type="number"
                                id="monthly-dep"
                                value={monthlyDeposit}
                                onChange={(e) => setMonthlyDeposit(e.target.value)}
                                disabled={loading}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="500"
                            />
                        </div>
                        <div>
                            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
                                Data de Início
                            </label>
                            <input
                                type="date"
                                id="start-date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                disabled={loading}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
                                Data de Fim
                            </label>
                            <input
                                type="date"
                                id="end-date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                disabled={loading}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* --- Botão de Simular --- */}
                    <button
                        type="submit"
                        disabled={loading || tickersLoading || !ticker}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    >
                        {loading ? "Simulando..." : "Rodar Simulação"}
                    </button>
                </form>
            </div>

            {/* --- ÁREA DE RESULTADOS (Resumo e Tabela) --- */}
            {/* ... (O JSX para "ÁREA DE RESULTADOS" não muda nada) ... */}
            <div className="space-y-8">
                {loading && <p className="text-gray-500 text-lg">Carregando simulação...</p>}
                {error && <p className="mt-6 text-red-600 bg-red-100 p-4 rounded-lg">{error}</p>}

                {/* --- RESUMO DA SIMULAÇÃO --- */}
                {summaryData && !loading && (
                    <div className="border border-gray-300 bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-2xl font-bold mb-4 text-gray-800">
                            Resumo da Simulação ({ticker} de {startDate} até {endDate})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                            {/* Card Geral */}
                            <div className="bg-gray-100 p-4 rounded-lg">
                                <h4 className="text-sm font-semibold text-gray-600 uppercase mb-2">Geral</h4>
                                <p className="text-gray-700">Total Investido:</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(summaryData.totalInvested)}
                                </p>
                            </div>

                            {/* Card Com Reinvestimento */}
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <h4 className="text-sm font-semibold text-green-700 uppercase mb-2">Com Reinvestimento</h4>
                                <p className="text-gray-700">Valor Final do Portfólio:</p>
                                <p className="text-2xl font-bold text-green-800">
                                    {formatCurrency(summaryData.reinvestFinalValue)}
                                </p>
                                <p className="text-gray-700 mt-2">Ganho Total:</p>
                                <p className="text-lg font-semibold text-green-800">
                                    {formatCurrency(summaryData.reinvestTotalGain)}
                                </p>
                            </div>

                            {/* Card Sem Reinvestimento */}
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                <h4 className="text-sm font-semibold text-purple-700 uppercase mb-2">Sem Reinvestimento</h4>
                                <p className="text-gray-700">Valor Final do Portfólio:</p>
                                <p className="text-2xl font-bold text-purple-800">
                                    {formatCurrency(summaryData.noReinvestFinalValue)}
                                </p>
                                <p className="text-gray-700 mt-2">Dividendos Sacados:</p>
                                <p className="text-lg font-semibold text-purple-800">
                                    {formatCurrency(summaryData.totalDividendsWithdrawn)}
                                </p>
                                <p className="text-gray-700 mt-2">Ganho Total (Portfólio + Sacado):</p>
                                <p className="text-lg font-semibold text-purple-800">
                                    {formatCurrency(summaryData.noReinvestTotalGain)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}


                {/* --- TABELA MÊS A MÊS --- */}
                {simulationData.length > 0 && !loading && (
                    <div className="border border-gray-300 bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-2xl font-bold mb-4 text-gray-800">
                            Detalhes da Simulação (Mês a Mês)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-300 text-sm whitespace-nowrap">
                                <thead className="bg-gray-100">
                                <tr>
                                    <th rowSpan="2" className="border px-3 py-2 text-left">Mês</th>
                                    <th rowSpan="2" className="border px-3 py-2 text-left">Aporte</th>
                                    <th colSpan="3" className="border px-3 py-2 text-center bg-green-50">Cenário: Reinvestindo</th>
                                    <th colSpan="3" className="border px-3 py-2 text-center bg-purple-50">Cenário: Sem Reinvestir</th>
                                    <th rowSpan="2" className="border px-3 py-2 text-left">Diferença</th>
                                </tr>
                                <tr>
                                    <th className="border px-3 py-2 text-left bg-green-50">Início</th>
                                    <th className="border px-3 py-2 text-left bg-green-50">Rend. (Div.)</th>
                                    <th className="border px-3 py-2 text-left bg-green-50">Fim</th>
                                    <th className="border px-3 py-2 text-left bg-purple-50">Início</th>
                                    <th className="border px-3 py-2 text-left bg-purple-50">Rend. (Sacado)</th>
                                    <th className="border px-3 py-2 text-left bg-purple-50">Fim</th>
                                </tr>
                                </thead>
                                <tbody>
                                {simulationData.map((row) => (
                                    <tr key={row.month} className="hover:bg-gray-50">
                                        <td className="border px-3 py-2">{row.month}</td>
                                        <td className="border px-3 py-2">{formatCurrency(row.deposit)}</td>
                                        {/* Reinvestindo */}
                                        <td className="border px-3 py-2 text-gray-600">{formatCurrency(row.reinvestStart)}</td>
                                        <td className="border px-3 py-2 text-green-700 font-medium">
                                            +{formatCurrency(row.reinvestDividends)}
                                        </td>
                                        <td className="border px-3 py-2 font-bold text-gray-900">{formatCurrency(row.reinvestEnd)}</td>
                                        {/* Sem Reinvestir */}
                                        <td className="border px-3 py-2 text-gray-600">{formatCurrency(row.noReinvestStart)}</td>
                                        <td className="border px-3 py-2 text-purple-700 font-medium">
                                            +{formatCurrency(row.noReinvestDividends)}
                                        </td>
                                        <td className="border px-3 py-2 font-bold text-gray-900">{formatCurrency(row.noReinvestEnd)}</td>
                                        {/* Diferença */}
                                        <td className="border px-3 py-2 font-semibold text-blue-700">
                                            {formatCurrency(row.difference)}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FiiSimulator;