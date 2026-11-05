import { useState, useEffect, useTransition, useRef } from 'react';
import ZScoreChart from './ZScoreChart.jsx';
import { Tooltip } from '../../components/Tooltip.jsx';
import { fetchUniqueStockTickers } from '../../services/b3service.js';
import { fetchDashboardData } from '../../services/walletDataService.js';
import { analysisService } from '../../services/api.js';

const MAX_MONTHS = 60;

export const getWalletAnalysisProgressText = ({ completed, total, currentTicker }) => {
  if (completed >= total) {
    return `Análises da carteira concluídas (${total} de ${total}).`;
  }

  return `Calculando ${currentTicker || 'carteira'}... (${completed} de ${total} concluídos)`;
};

function getWindowLabel(months) {
  if (months < 12) return `(${months} meses)`;
  if (months === 12) return `(~1 ano)`;
  if (months % 12 === 0) return `(${months / 12} anos)`;
  return `(${months} meses)`;
}

function getTypeBadgeClass(type) {
  switch (type?.toUpperCase()) {
    case 'FII':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'STOCK':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'ETF':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getZScoreTextClass(zScore) {
  const value = Number.parseFloat(String(zScore).replace(',', '.'));

  if (value <= -2) {
    return 'text-green-700 dark:text-green-300';
  }
  if (value <= -1) {
    return 'text-green-600 dark:text-green-400';
  }
  if (value < 1) {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (value < 2) {
    return 'text-red-600 dark:text-red-400';
  }
  return 'text-red-700 dark:text-red-300';
}

function getProfitTextClass(profitPercent) {
  const value = Number(profitPercent);
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-300';
}

function formatProfitPercent(profitPercent) {
  if (profitPercent == null || Number.isNaN(Number(profitPercent))) return '—';
  const value = Number(profitPercent);
  return `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function getNegativeYearDetails(chartData) {
  if (!chartData?.length) return [];

  const yearlyPrices = new Map();
  chartData.forEach((item) => {
    const year = new Date(item.date).getFullYear();
    const price = Number(item.adjusted_close ?? item.close);
    if (!Number.isFinite(price)) return;

    const yearData = yearlyPrices.get(year) || { first: price, last: price };
    yearData.last = price;
    yearlyPrices.set(year, yearData);
  });

  const years = [...yearlyPrices.entries()]
    .map(([year, prices]) => ({ year, ...prices }))
    .filter(({ first, last }) => first !== last);
  return years
    .filter(({ first, last }) => last < first)
    .map(({ year, first, last }) => ({
      year,
      cagr: (last / first - 1) * 100,
    }));
}

function getCagr(chartData) {
  if (!chartData || chartData.length < 2) return null;

  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const firstPrice = Number(first.adjusted_close ?? first.close);
  const lastPrice = Number(last.adjusted_close ?? last.close);
  const firstDate = new Date(first.date);
  const lastDate = new Date(last.date);
  const years = (lastDate - firstDate) / (365.2425 * 24 * 60 * 60 * 1000);

  if (firstPrice <= 0 || lastPrice <= 0 || years <= 0) return null;
  return (Math.pow(lastPrice / firstPrice, 1 / years) - 1) * 100;
}

function PricePositionCalculator() {
  const [selectedTicker, setSelectedTicker] = useState('');
  const [tickerList, setTickerList] = useState([]);
  const [walletTickers, setWalletTickers] = useState([]);
  const [walletZScores, setWalletZScores] = useState({});
  const [walletNegativeYears, setWalletNegativeYears] = useState({});
  const [walletCagrs, setWalletCagrs] = useState({});
  const [walletAnalysisStatus, setWalletAnalysisStatus] = useState({});
  const [walletAnalysisErrors, setWalletAnalysisErrors] = useState({});
  const [walletAnalysisProgress, setWalletAnalysisProgress] = useState({
    completed: 0,
    total: 0,
    currentTicker: '',
  });
  const [isLoadingWalletZScores, setIsLoadingWalletZScores] = useState(false);
  const [walletTickersLoaded, setWalletTickersLoaded] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const walletAnalysisResultsRef = useRef({});

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const comboboxRef = useRef(null);
  const inputRef = useRef(null);

  const [result, setResult] = useState(null);
  const [chartData, setChartData] = useState([]);

  const [timeWindowInMonths, setTimeWindowInMonths] = useState(12);
  const [deferredTimeWindow, setDeferredTimeWindow] = useState(12);
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadTickers() {
      try {
        const tickers = await fetchUniqueStockTickers();
        setTickerList(tickers);
        const defaultTicker = tickers.includes('VALE3') ? 'VALE3' : tickers[0] || '';
        if (defaultTicker) setSelectedTicker(defaultTicker);
      } catch (err) {
        setErrorMessage('Erro ao carregar lista de Ações.');
      }
    }
    loadTickers();
  }, []);

  useEffect(() => {
    if (!walletTickers.length) {
      setIsLoadingWalletZScores(false);
      setWalletZScores({});
      setWalletNegativeYears({});
      setWalletCagrs({});
      setWalletAnalysisStatus({});
      setWalletAnalysisErrors({});
      setWalletAnalysisProgress({ completed: 0, total: 0, currentTicker: '' });
      return undefined;
    }

    let isMounted = true;
    const total = walletTickers.length;

    setIsLoadingWalletZScores(true);
    setWalletZScores({});
    setWalletNegativeYears({});
    setWalletCagrs({});
    setWalletAnalysisStatus(
      Object.fromEntries(walletTickers.map((position) => [position.ticker, 'loading']))
    );
    setWalletAnalysisErrors({});
    setWalletAnalysisProgress({ completed: 0, total, currentTicker: walletTickers[0].ticker });
    walletAnalysisResultsRef.current = {};

    Promise.all(
      walletTickers.map(async (position) => {
        if (isMounted) {
          setWalletAnalysisProgress((current) => ({
            ...current,
            currentTicker: position.ticker,
          }));
        }

        try {
          const data = await analysisService.getZScore(position.ticker, deferredTimeWindow);
          if (isMounted) {
            walletAnalysisResultsRef.current[position.ticker] = data;
            setWalletZScores((current) => ({
              ...current,
              [position.ticker]: data.stats.zScore,
            }));
            setWalletNegativeYears((current) => ({
              ...current,
              [position.ticker]: getNegativeYearDetails(data.chart_data),
            }));
            setWalletCagrs((current) => ({
              ...current,
              [position.ticker]: getCagr(data.chart_data),
            }));
            setWalletAnalysisStatus((current) => ({ ...current, [position.ticker]: 'done' }));
            setWalletAnalysisProgress((current) => ({
              ...current,
              completed: current.completed + 1,
              currentTicker: position.ticker,
            }));
          }
        } catch (error) {
          if (isMounted) {
            setWalletAnalysisStatus((current) => ({ ...current, [position.ticker]: 'error' }));
            setWalletAnalysisErrors((current) => ({
              ...current,
              [position.ticker]: error.message,
            }));
            setWalletAnalysisProgress((current) => ({
              ...current,
              completed: current.completed + 1,
              currentTicker: position.ticker,
            }));
          }
        }
      })
    ).then(() => {
      if (!isMounted) return;
      setIsLoadingWalletZScores(false);
    });

    return () => {
      isMounted = false;
    };
  }, [walletTickers, deferredTimeWindow]);

  useEffect(() => {
    let isMounted = true;

    async function loadWalletTickers() {
      try {
        const dashboard = await fetchDashboardData();
        const positions = dashboard.positions || [];
        if (!isMounted) return;

        const uniqueTickers = Array.from(
          new Map(
            positions
              .filter((position) => position.ticker)
              .map((position) => [
                position.ticker.toUpperCase(),
                { ...position, ticker: position.ticker.toUpperCase() },
              ])
          ).values()
        ).sort((a, b) => a.ticker.localeCompare(b.ticker));

        setWalletTickers(uniqueTickers);
      } finally {
        if (isMounted) setWalletTickersLoaded(true);
      }
    }

    loadWalletTickers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTicker || !walletTickersLoaded) return;

    const isWalletTicker = walletTickers.some((position) => position.ticker === selectedTicker);
    const walletTickerStatus = walletAnalysisStatus[selectedTicker];

    if (isWalletTicker && !walletTickerStatus) return;
    if (isWalletTicker && walletTickerStatus === 'loading') return;

    const fetchData = async () => {
      setLoading(true);
      setErrorMessage('');
      setResult(null);
      setChartData([]);

      const cachedAnalysis = walletAnalysisResultsRef.current[selectedTicker];
      if (cachedAnalysis?.window_months === deferredTimeWindow) {
        setResult(cachedAnalysis.stats);
        setChartData(cachedAnalysis.chart_data);
        setLoading(false);
        return undefined;
      }

      if (isWalletTicker && walletTickerStatus === 'error') {
        setErrorMessage(
          walletAnalysisErrors[selectedTicker] ||
            `Não foi possível analisar ${selectedTicker}: histórico insuficiente.`
        );
        setLoading(false);
        return undefined;
      }

      try {
        const data = await analysisService.getZScore(selectedTicker, deferredTimeWindow);

        setResult(data.stats);
        setChartData(data.chart_data);
      } catch (err) {
        setErrorMessage(err.message || 'Erro ao calcular Z-Score.');
        setResult(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    selectedTicker,
    deferredTimeWindow,
    walletTickersLoaded,
    walletTickers,
    walletAnalysisStatus,
    walletAnalysisErrors,
    isLoadingWalletZScores,
  ]);

  const filteredTickers = tickerList.filter((t) =>
    t.toLowerCase().includes(selectedTicker.toLowerCase())
  );

  const handleBlur = (e) => {
    if (comboboxRef.current && !comboboxRef.current.contains(e.relatedTarget)) {
      setIsDropdownOpen(false);
    }
  };

  const windowLabel = getWindowLabel(timeWindowInMonths);
  const sortedWalletTickers = [...walletTickers].sort((a, b) => {
    const scoreA = walletZScores[a.ticker];
    const scoreB = walletZScores[b.ticker];

    if (scoreA == null) return 1;
    if (scoreB == null) return -1;
    return scoreA - scoreB;
  });

  return (
    <div className="p-8 max-w-7xl">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
        Analisador PRO (Z-Score / Desvio Padrão)
      </h2>

      <div
        className={`grid grid-cols-1 gap-6 items-start ${
          showPerformance
            ? 'lg:grid-cols-[minmax(0,3fr)_minmax(500px,1.55fr)]'
            : 'lg:grid-cols-[minmax(0,3fr)_minmax(440px,1.45fr)]'
        }`}
      >
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors duration-200">
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Análise estatística processada via Python (Pandas/NumPy).
            </p>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Busque qualquer ação:
            </label>

            <div className="relative mb-6" ref={comboboxRef} onBlur={handleBlur}>
              <input
                ref={inputRef}
                type="text"
                value={selectedTicker}
                disabled={loading && tickerList.length === 0}
                onChange={(e) => {
                  setSelectedTicker(e.target.value.toUpperCase());
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              />
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredTickers.map((t) => (
                    <div
                      key={t}
                      className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-gray-600 cursor-pointer text-gray-800 dark:text-gray-200"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedTicker(t);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Janela de Análise:{' '}
              <span className="font-bold text-gray-900 dark:text-white">
                {timeWindowInMonths} meses
              </span>
            </label>
            <input
              type="range"
              min="6"
              max={MAX_MONTHS}
              step="1"
              value={timeWindowInMonths}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                setTimeWindowInMonths(newValue);
                startTransition(() => setDeferredTimeWindow(newValue));
              }}
              className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer mt-2 mb-4 accent-blue-600"
            />
          </div>

          {(loading || isLoadingWalletZScores) && (
            <div className="mt-6 text-center text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
              {isLoadingWalletZScores
                ? getWalletAnalysisProgressText(walletAnalysisProgress)
                : `Calculando ${selectedTicker}...`}
            </div>
          )}

          {errorMessage && (
            <div className="mt-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
              {errorMessage}
            </div>
          )}

          {!loading && result && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-slate-800 dark:border dark:border-slate-700 rounded-lg shadow-md transition-colors duration-200">
              <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-200">
                Resultado para {selectedTicker} {windowLabel}:
              </h3>

              <div className="grid grid-cols-1 gap-x-8 gap-y-1 text-gray-800 dark:text-gray-300 md:grid-cols-2">
                <p>
                  <strong className="text-gray-900 dark:text-white">Preço atual:</strong> R${' '}
                  {result.current}
                </p>
                <p>
                  <strong className="text-gray-900 dark:text-white">Média:</strong> R${' '}
                  {result.media}
                </p>
                <p>
                  <strong className="text-gray-900 dark:text-white">Z-Score:</strong>{' '}
                  {result.zScore}
                </p>
                <p>
                  <strong className="text-gray-900 dark:text-white">Range:</strong> R$ {result.min}{' '}
                  - {result.max}
                </p>

                <p className="mt-2 text-sm text-gray-700 dark:text-gray-400 md:mt-4">
                  O preço esteve menor ou igual ao atual em{' '}
                  <strong className="text-gray-900 dark:text-white">{result.percentile}%</strong>{' '}
                  dos dias.
                </p>

                <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white md:mt-4 md:text-right">
                  {result.status}
                </p>
              </div>
            </div>
          )}

          {!loading && result && chartData.length > 0 && (
            <div className={`mt-8 ${isPending ? 'opacity-60 transition-opacity' : ''}`}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 pt-8 transition-colors duration-200">
                <ZScoreChart historicalPrices={chartData} analysisResult={result} />
              </div>
            </div>
          )}
        </div>

        <aside className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 transition-colors duration-200 lg:sticky lg:top-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
            Ativos da minha carteira
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Clique em um ativo para analisar.
          </p>
          <label className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showPerformance}
              onChange={(event) => setShowPerformance(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Mostrar desempenho
          </label>

          {!walletTickersLoaded ? (
            <div
              className="animate-pulse rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              role="status"
              aria-label="Carregando ativos da carteira"
            >
              <div className="mb-3 grid grid-cols-5 gap-3">
                {Array.from({ length: 5 }, (_, index) => (
                  <div
                    key={`header-skeleton-${index}`}
                    className="h-3 rounded bg-gray-200 dark:bg-gray-700"
                  />
                ))}
              </div>
              <div className="space-y-3">
                {Array.from({ length: 6 }, (_, rowIndex) => (
                  <div
                    key={`row-skeleton-${rowIndex}`}
                    className="grid grid-cols-5 items-center gap-3"
                  >
                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="ml-auto h-4 w-10 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="ml-auto h-4 w-8 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="ml-auto h-4 w-12 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                ))}
              </div>
            </div>
          ) : walletTickers.length > 0 ? (
            <div className="overflow-visible rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Ticker</th>
                    <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {isLoadingWalletZScores
                        ? `Z-Score (${walletAnalysisProgress.completed}/${walletAnalysisProgress.total})`
                        : 'Z-Score'}
                    </th>
                    {showPerformance && (
                      <>
                        <th className="px-3 py-2 text-right font-semibold">
                          <Tooltip content="Anos com retorno negativo no período analisado">
                            Anos negativos
                          </Tooltip>
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          <Tooltip content="CAGR anualizado desde o início do período analisado">
                            CAGR
                            <br />
                            a.a.
                          </Tooltip>
                        </th>
                      </>
                    )}
                    {showPerformance && (
                      <th className="px-3 py-2 text-right font-semibold">
                        <Tooltip content="Rentabilidade total: valorização do ativo + dividendos/proventos recebidos">
                          Rentab.
                        </Tooltip>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedWalletTickers.map((position) => (
                    <tr
                      key={position.ticker}
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelectedTicker(position.ticker)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedTicker(position.ticker);
                      }}
                      className={`cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/30 ${
                        selectedTicker === position.ticker ? 'bg-blue-100 dark:bg-blue-900/50' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100">
                        {position.ticker}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${getTypeBadgeClass(position.type)}`}
                        >
                          {position.type || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-200">
                        {walletZScores[position.ticker] != null ? (
                          <span className={getZScoreTextClass(walletZScores[position.ticker])}>
                            {walletZScores[position.ticker]}
                          </span>
                        ) : walletAnalysisStatus[position.ticker] === 'loading' ? (
                          <span className="text-blue-500 animate-pulse">calculando…</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      {showPerformance && (
                        <>
                          <td className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-200">
                            {walletNegativeYears[position.ticker]?.length > 0 ? (
                              <span
                                className="inline-flex items-center justify-end gap-1"
                                aria-label={`${walletNegativeYears[position.ticker].length} anos negativos`}
                              >
                                {Array.from(
                                  { length: walletNegativeYears[position.ticker].length },
                                  (_, index) => {
                                    const negativeYear =
                                      walletNegativeYears[position.ticker][index];
                                    return (
                                      <Tooltip
                                        key={negativeYear.year}
                                        content={`${negativeYear.year}: CAGR ${formatProfitPercent(negativeYear.cagr)}`}
                                      >
                                        <span className="h-2 w-2 rounded-full bg-red-500" />
                                      </Tooltip>
                                    );
                                  }
                                )}
                              </span>
                            ) : (
                              <Tooltip content="Nenhum ano negativo">
                                <span className="text-gray-400">—</span>
                              </Tooltip>
                            )}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-semibold ${getProfitTextClass(walletCagrs[position.ticker])}`}
                          >
                            <Tooltip content="CAGR anualizado desde o início do período analisado">
                              {formatProfitPercent(walletCagrs[position.ticker])}
                            </Tooltip>
                          </td>
                        </>
                      )}
                      {showPerformance && (
                        <td
                          className={`px-3 py-2 text-right font-semibold ${getProfitTextClass(position.profit_percent)}`}
                        >
                          {formatProfitPercent(position.profit_percent)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg bg-gray-100 dark:bg-gray-700/60 px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
              Nenhum ativo cadastrado na carteira.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

export default PricePositionCalculator;
