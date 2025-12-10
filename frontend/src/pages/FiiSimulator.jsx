import React, { useState, useEffect, useRef } from 'react';
import { fetchUniqueTickers } from '../services/b3service.js';
import { analysisService } from '../services/api.js';
import SimulationChart from '../components/SimulationChart.jsx';

const formatCurrency = (num) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);

function FiiSimulator() {
  const [ticker, setTicker] = useState('');
  const [initialInvestment, setInitialInvestment] = useState('1000');
  const [monthlyDeposit, setMonthlyDeposit] = useState('500');
  const [simulationMonths, setSimulationMonths] = useState('24');

  const [simulationPeriodText, setSimulationPeriodText] = useState('');
  const [tickerList, setTickerList] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const comboboxRef = useRef(null);

  const [simulationData, setSimulationData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadTickers() {
      try {
        const tickers = await fetchUniqueTickers();
        setTickerList(tickers);
        const defaultTicker = tickers.includes('BPFF11') ? 'BPFF11' : tickers[0] || '';
        if (defaultTicker) setTicker(defaultTicker);
      } catch (err) {
        setError('Erro ao carregar lista de tickers.');
      }
    }
    loadTickers();
  }, []);

  const handleRunSimulation = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSimulationData([]);
    setSummaryData(null);

    try {
      const payload = {
        ticker: ticker,
        initial_investment: parseFloat(initialInvestment),
        monthly_deposit: parseFloat(monthlyDeposit),
        months: parseInt(simulationMonths),
      };

      const data = await analysisService.runFiiSimulation(payload);

      setSummaryData(data.summary);
      setSimulationData(data.timeline);
      setSimulationPeriodText(data.period_text);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao rodar a simulação.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTickers = tickerList.filter((t) => t.toLowerCase().includes(ticker.toLowerCase()));

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white transition-colors">
        Simulador de Investimento (Backend Python)
      </h2>

      <div className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-2xl mb-8 transition-colors">
        <form onSubmit={handleRunSimulation} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ticker do FII
            </label>
            <div className="relative" ref={comboboxRef}>
              <input
                ref={inputRef}
                type="text"
                value={ticker}
                onChange={(e) => {
                  setTicker(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase"
              />
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredTickers.map((t) => (
                    <div
                      key={t}
                      className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-gray-600 cursor-pointer text-gray-900 dark:text-gray-100"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setTicker(t);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Inicial (R$)
              </label>
              <input
                type="number"
                value={initialInvestment}
                onChange={(e) => setInitialInvestment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mensal (R$)
              </label>
              <input
                type="number"
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Meses
              </label>
              <input
                type="number"
                value={simulationMonths}
                onChange={(e) => setSimulationMonths(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Simulando...' : 'Rodar Simulação'}
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {summaryData && !loading && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
              Resumo{' '}
              <span className="text-lg font-normal text-gray-500">{simulationPeriodText}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-500 uppercase">Total Investido</h4>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(summaryData.totalInvested)}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="text-sm font-semibold text-green-700 uppercase">
                  Reinvestindo (Final)
                </h4>
                <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                  {formatCurrency(summaryData.reinvestFinalValue)}
                </p>
                <p className="text-sm mt-1 text-green-600">
                  Lucro: {formatCurrency(summaryData.reinvestTotalGain)}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="text-sm font-semibold text-purple-700 uppercase">
                  Sem Reinvestir (Final)
                </h4>
                <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                  {formatCurrency(summaryData.noReinvestFinalValue)}
                </p>
                <p className="text-sm mt-1 text-purple-600">
                  Sacado: {formatCurrency(summaryData.totalDividendsWithdrawn)}
                </p>
              </div>
            </div>
          </div>

          {simulationData.length > 0 && (
            <div className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                Gráfico de Evolução
              </h3>
              <SimulationChart data={simulationData} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FiiSimulator;
