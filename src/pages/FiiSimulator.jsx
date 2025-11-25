import React, { useState, useEffect, useRef } from 'react';
import {
  fetchFiiDividendForMonth,
  fetchUniqueTickers,
  fetchFiiDateRange,
} from '../services/b3service.js';
import { getIpcaRange } from '../services/ipcaService.js';
import SimulationChart from '../components/SimulationChart.jsx';
import { supabase } from '../services/supabaseClient.js';

const formatCurrency = (num) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);

const formatDate = (date) => {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

function addMonths(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  const day = d.getUTCDate();
  const daysInMonth = new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 0).getUTCDate();
  if (day > daysInMonth) {
    d.setUTCDate(daysInMonth);
  }
  return d;
}

function FiiSimulator() {
  const [ticker, setTicker] = useState('');
  const [initialInvestment, setInitialInvestment] = useState('1000');
  const [monthlyDeposit, setMonthlyDeposit] = useState('500');
  const [simulationMonths, setSimulationMonths] = useState('24');
  const [simulationPeriodText, setSimulationPeriodText] = useState('');

  const [tickerList, setTickerList] = useState([]);
  const [tickersLoading, setTickersLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const comboboxRef = useRef(null);

  const [simulationData, setSimulationData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [copySuccess, setCopySuccess] = useState('');

  const [fiiDateRange, setFiiDateRange] = useState(null);
  const [dateRangeLoading, setDateRangeLoading] = useState(false);
  const [dateRangeError, setDateRangeError] = useState(null);

  useEffect(() => {
    async function loadTickers() {
      setTickersLoading(true);
      setError(null);
      try {
        const tickers = await fetchUniqueTickers();
        setTickerList(tickers);
        const defaultTicker = tickers.includes('BPFF11') ? 'BPFF11' : tickers[0] || '';
        if (defaultTicker) {
          setTicker(defaultTicker);
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar lista de tickers.');
      } finally {
        setTickersLoading(false);
      }
    }
    loadTickers();
  }, []);

  useEffect(() => {
    if (!ticker) {
      setFiiDateRange(null);
      setDateRangeError(null);
      return;
    }

    async function loadDateRange() {
      setDateRangeLoading(true);
      setDateRangeError(null);
      setFiiDateRange(null);
      setError(null);

      try {
        const range = await fetchFiiDateRange(ticker);
        setFiiDateRange(range);

        if (range && range.oldest_date && range.newest_date) {
          const [endYear, endMonth] = range.newest_date.split('-').map(Number);
          const [oldYear, oldMonth] = range.oldest_date.split('-').map(Number);
          const maxMonths = (endYear - oldYear) * 12 + (endMonth - oldMonth) + 1;

          setSimulationMonths((currentMonthsStr) => {
            const currentMonths = parseInt(currentMonthsStr, 10) || 0;
            if (currentMonths > maxMonths) {
              return String(maxMonths);
            }
            return currentMonthsStr;
          });
        }
      } catch (err) {
        console.error(err);
        setDateRangeError(`Erro ao buscar histórico para ${ticker}.`);
      } finally {
        setDateRangeLoading(false);
      }
    }

    loadDateRange();
  }, [ticker]);

  const handleRunSimulation = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSimulationData([]);
    setSummaryData(null);
    setSimulationPeriodText('');

    try {
      const initialInv = parseFloat(initialInvestment) || 0;
      const monthlyDep = parseFloat(monthlyDeposit) || 0;
      const requestedMonths = parseInt(simulationMonths) || 1;

      const dateRange = fiiDateRange;

      if (!dateRange || !dateRange.newest_date || !dateRange.oldest_date) {
        throw new Error(dateRangeError || `Histórico de datas para ${ticker} não foi carregado.`);
      }

      const [endYear, endMonth, endDay] = dateRange.newest_date.split('-').map(Number);
      const simEndDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

      let simStartDate = addMonths(simEndDate, -(requestedMonths - 1));
      simStartDate.setUTCDate(1);

      const [oldYear, oldMonth, oldDay] = dateRange.oldest_date.split('-').map(Number);
      const oldestDateObj = new Date(Date.UTC(oldYear, oldMonth - 1, oldDay));
      oldestDateObj.setUTCDate(1);

      let actualMonths = requestedMonths;

      if (simStartDate < oldestDateObj) {
        const oldStartDate = simStartDate;
        simStartDate = oldestDateObj;

        actualMonths =
          (simEndDate.getUTCFullYear() - simStartDate.getUTCFullYear()) * 12 +
          (simEndDate.getUTCMonth() - simStartDate.getUTCMonth()) +
          1;

        setError(
          `Aviso: O período solicitado (${requestedMonths} meses) é maior que o histórico disponível. Simulando com ${actualMonths} meses.`
        );
      }

      const ipcaStartYear = simStartDate.getUTCFullYear();
      const ipcaStartMonth = simStartDate.getUTCMonth() + 1;
      const ipcaEndYear = simEndDate.getUTCFullYear();
      const ipcaEndMonth = simEndDate.getUTCMonth() + 1;

      let ipcaMap = new Map();
      try {
        const ipcaData = await getIpcaRange(
          ipcaStartYear,
          ipcaStartMonth,
          ipcaEndYear,
          ipcaEndMonth
        );
        for (const row of ipcaData) {
          const [year, month] = row.ref_date.split('-').map(Number);
          const key = `${year}-${month}`;
          ipcaMap.set(key, 1 + row.ipca / 100);
        }
      } catch (ipcaError) {
        console.error('Erro ao buscar IPCA:', ipcaError);
      }

      setSimulationPeriodText(
        `(${actualMonths} meses: ${formatDate(simStartDate)} a ${formatDate(simEndDate)})`
      );

      let sharesReinvest = 0;
      let sharesNoReinvest = 0;
      let totalDividendsWithdrawn = 0;
      let totalInvested = 0;
      let simulationTable = [];

      let lastPrice = 0;
      let lastDividend = 0;

      const firstMonthData = await fetchFiiDividendForMonth(
        ticker,
        simStartDate.getUTCMonth() + 1,
        simStartDate.getUTCFullYear()
      );

      if (!firstMonthData) {
        const { data: firstEverData, error: firstEverError } = await supabase
          .from('b3_fiis_dividends')
          .select('price_close, dividend_value')
          .eq('ticker', ticker.toUpperCase())
          .gte('trade_date', dateRange.oldest_date)
          .order('trade_date', { ascending: true })
          .limit(1)
          .single();

        if (firstEverError || !firstEverData) {
          throw new Error(
            `Falha crítica: não foi possível obter nenhum preço inicial para ${ticker}.`
          );
        }
        lastPrice = parseFloat(firstEverData.price_close);
        lastDividend = lastPrice * parseFloat(firstEverData.dividend_value);
      } else {
        lastPrice = parseFloat(firstMonthData.price_close);
        lastDividend = lastPrice * parseFloat(firstMonthData.dividend_value);
      }

      totalInvested = initialInv;
      sharesReinvest = initialInv / lastPrice;
      sharesNoReinvest = initialInv / lastPrice;

      let inflationCorrectedValue = initialInv;

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
        currentPrice: lastPrice,
        totalInvested: totalInvested,
        inflationCorrected: inflationCorrectedValue,
      });

      let currentDate = addMonths(simStartDate, 1);

      while (currentDate <= simEndDate) {
        const currentMonth = currentDate.getUTCMonth() + 1;
        const currentYear = currentDate.getUTCFullYear();

        const monthData = await fetchFiiDividendForMonth(ticker, currentMonth, currentYear);

        let currentPrice = lastPrice;
        let dividendPerShare = 0;

        if (monthData) {
          currentPrice = parseFloat(monthData.price_close);
          const yieldValue = parseFloat(monthData.dividend_value);
          dividendPerShare = currentPrice * yieldValue;
          lastPrice = currentPrice;
          lastDividend = dividendPerShare;
        } else {
          currentPrice = lastPrice;
          dividendPerShare = lastDividend;
        }

        const prevDate = addMonths(currentDate, -1);
        const prevMonth = prevDate.getUTCMonth() + 1;
        const prevYear = prevDate.getUTCFullYear();
        const prevMonthKey = `${prevYear}-${prevMonth}`;
        const monthIpcaFactor = ipcaMap.get(prevMonthKey) || 1.0;

        inflationCorrectedValue = inflationCorrectedValue * monthIpcaFactor + monthlyDep;
        totalInvested += monthlyDep;

        const startValueReinvest = sharesReinvest * currentPrice;
        const dividendsReinvest = sharesReinvest * dividendPerShare;
        const totalToBuyReinvest = monthlyDep + dividendsReinvest;
        const newSharesReinvest = totalToBuyReinvest / currentPrice;
        sharesReinvest += newSharesReinvest;
        const endValueReinvest = sharesReinvest * currentPrice;

        const startValueNoReinvest = sharesNoReinvest * currentPrice;
        const dividendsNoReinvest = sharesNoReinvest * dividendPerShare;
        const newSharesNoReinvest = monthlyDep / currentPrice;
        sharesNoReinvest += newSharesNoReinvest;
        totalDividendsWithdrawn += dividendsNoReinvest;
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
          currentPrice: currentPrice,

          totalInvested: totalInvested,
          inflationCorrected: inflationCorrectedValue,
        });

        currentDate = addMonths(currentDate, 1);
      }

      setSimulationData(simulationTable);

      const reinvestFinalValue = sharesReinvest * lastPrice;
      const noReinvestFinalValue = sharesNoReinvest * lastPrice;

      setSummaryData({
        totalInvested: totalInvested,
        reinvestFinalValue: reinvestFinalValue,
        reinvestTotalGain: reinvestFinalValue - totalInvested,
        noReinvestFinalValue: noReinvestFinalValue,
        totalDividendsWithdrawn: totalDividendsWithdrawn,
        noReinvestTotalGain: noReinvestFinalValue + totalDividendsWithdrawn - totalInvested,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao rodar a simulação.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!simulationData || simulationData.length === 0) return;
    const headers = [
      'Mês',
      'Aporte',
      'Reinv. Início',
      'Reinv. Dividendos',
      'Reinv. Fim',
      'S/ Reinv. Início',
      'S/ Reinv. Dividendos',
      'S/ Reinv. Fim',
      'Diferença',
    ].join('\t');

    const rows = simulationData
      .map((row) => {
        return [
          row.month,
          formatCurrency(row.deposit),
          formatCurrency(row.reinvestStart),
          formatCurrency(row.reinvestDividends),
          formatCurrency(row.reinvestEnd),
          formatCurrency(row.noReinvestStart),
          formatCurrency(row.noReinvestDividends),
          formatCurrency(row.noReinvestEnd),
          formatCurrency(row.difference),
        ].join('\t');
      })
      .join('\n');

    const csvContent = `${headers}\n${rows}`;
    try {
      await navigator.clipboard.writeText(csvContent);
      setCopySuccess('Copiado!');
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
      setCopySuccess('Erro ao copiar');
    }
  };

  const handleBlur = (e) => {
    if (comboboxRef.current && !comboboxRef.current.contains(e.relatedTarget)) {
      setIsDropdownOpen(false);
    }
  };
  const filteredTickers = tickerList.filter((t) => t.toLowerCase().includes(ticker.toLowerCase()));

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white transition-colors">
        Simulador de Investimento em FIIs
      </h2>

      <div className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-2xl mb-8 transition-colors">
        <form onSubmit={handleRunSimulation} className="space-y-4">
          <div>
            <label
              htmlFor="ticker-input"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Ticker do FII
            </label>
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                autoComplete="off"
              />
              <button
                type="button"
                disabled={tickersLoading || loading}
                onClick={() => {
                  setIsDropdownOpen((state) => !state);
                  inputRef.current.focus();
                }}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-10 h-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
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
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {tickersLoading ? (
                    <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
                      Carregando tickers...
                    </div>
                  ) : filteredTickers.length > 0 ? (
                    filteredTickers.map((t) => (
                      <div
                        key={t}
                        className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-gray-600 cursor-pointer text-gray-900 dark:text-gray-100"
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
                    <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
                      Nenhum ticker encontrado.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="initial-inv"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Investimento Inicial (R$)
              </label>
              <input
                type="number"
                id="initial-inv"
                value={initialInvestment}
                onChange={(e) => setInitialInvestment(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                placeholder="10000"
              />
            </div>
            <div>
              <label
                htmlFor="monthly-dep"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Aporte Mensal (R$)
              </label>
              <input
                type="number"
                id="monthly-dep"
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                placeholder="500"
              />
            </div>
            <div>
              <label
                htmlFor="sim-months"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Período (meses)
              </label>
              <input
                type="number"
                id="sim-months"
                value={simulationMonths}
                onChange={(e) => setSimulationMonths(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                placeholder="24"
              />
              <div className="h-5 mt-1">
                {dateRangeLoading && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Carregando histórico...
                  </p>
                )}
                {dateRangeError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{dateRangeError}</p>
                )}
                {fiiDateRange && !dateRangeLoading && !dateRangeError && (
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Data mais antiga:{' '}
                    {formatDate(new Date(fiiDateRange.oldest_date.replace(/-/g, '/')))}
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || tickersLoading || !ticker || dateRangeLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Simulando...' : 'Rodar Simulação'}
          </button>
        </form>
      </div>

      <div className="space-y-8">
        {loading && (
          <p className="text-gray-500 dark:text-gray-400 text-lg">Carregando simulação...</p>
        )}

        {error && (
          <p
            className={`mt-6 p-4 rounded-lg ${
              error.startsWith('Aviso:')
                ? 'text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300'
                : 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            {error}
          </p>
        )}

        {summaryData && !loading && (
          <div className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-colors">
            <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
              Resumo da Simulação {ticker}
              <span className="text-lg font-normal text-gray-600 dark:text-gray-400 ml-2">
                {simulationPeriodText}
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase mb-2">
                  Geral
                </h4>
                <p className="text-gray-700 dark:text-gray-300">Total Investido:</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(summaryData.totalInvested)}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase mb-2">
                  Com Reinvestimento
                </h4>
                <p className="text-gray-700 dark:text-gray-300">Valor Final do Portfólio:</p>
                <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                  {formatCurrency(summaryData.reinvestFinalValue)}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mt-2">Ganho Total:</p>
                <p className="text-lg font-semibold text-green-800 dark:text-green-300">
                  {formatCurrency(summaryData.reinvestTotalGain)}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400 uppercase mb-2">
                  Sem Reinvestimento
                </h4>
                <p className="text-gray-700 dark:text-gray-300">Valor Final do Portfólio:</p>
                <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                  {formatCurrency(summaryData.noReinvestFinalValue)}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mt-2">Dividendos Sacados:</p>
                <p className="text-lg font-semibold text-purple-800 dark:text-purple-300">
                  {formatCurrency(summaryData.totalDividendsWithdrawn)}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mt-2">
                  Ganho Total (Portfólio + Sacado):
                </p>
                <p className="text-lg font-semibold text-purple-800 dark:text-purple-300">
                  {formatCurrency(summaryData.noReinvestTotalGain)}
                </p>
              </div>
            </div>
          </div>
        )}

        {simulationData.length > 0 && !loading && (
          <div className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6 transition-colors">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                Detalhes da Simulação (Mês a Mês)
              </h3>

              <button
                onClick={handleCopyToClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 transition-colors"
                title="Copiar tabela para colar no Excel"
              >
                {copySuccess === 'Copiado!' ? (
                  <>
                    <svg
                      className="w-5 h-5 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-green-600 dark:text-green-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                      />
                    </svg>
                    <span>Copiar Tabela</span>
                  </>
                )}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 text-sm whitespace-nowrap">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <tr>
                    <th
                      rowSpan="2"
                      className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left"
                    >
                      Mês
                    </th>
                    <th
                      rowSpan="2"
                      className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left"
                    >
                      Aporte
                    </th>
                    <th
                      colSpan="3"
                      className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-100"
                    >
                      Cenário: Reinvestindo
                    </th>
                    <th
                      colSpan="3"
                      className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center bg-purple-50 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100"
                    >
                      Cenário: Sem Reinvestir
                    </th>
                    <th
                      rowSpan="2"
                      className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left"
                    >
                      Diferença
                    </th>
                  </tr>
                  <tr>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-100">
                      Início
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-100">
                      Rend. (Div.)
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-100">
                      Fim
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left bg-purple-50 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100">
                      Início
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left bg-purple-50 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100">
                      Rend. (Sacado)
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left bg-purple-50 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100">
                      Fim
                    </th>
                  </tr>
                </thead>
                <tbody className="text-gray-900 dark:text-gray-200">
                  {simulationData.map((row) => (
                    <tr key={row.month} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                        {row.month}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                        {formatCurrency(row.deposit)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-600 dark:text-gray-400">
                        {formatCurrency(row.reinvestStart)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-green-700 dark:text-green-400 font-medium">
                        +{formatCurrency(row.noReinvestDividends)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-bold text-gray-900 dark:text-white">
                        {formatCurrency(row.reinvestEnd)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-600 dark:text-gray-400">
                        {formatCurrency(row.noReinvestStart)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-purple-700 dark:text-purple-400 font-medium">
                        +{formatCurrency(row.reinvestDividends)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-bold text-gray-900 dark:text-white">
                        {formatCurrency(row.noReinvestEnd)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-semibold text-blue-700 dark:text-blue-400">
                        {formatCurrency(row.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-2xl font-bold pt-4 text-gray-800 dark:text-white">
              Evolução do Patrimônio vs. Preço da Cota
            </h3>

            <div className="-mx-6 mt-4 mb-2">
              <SimulationChart data={simulationData} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FiiSimulator;
