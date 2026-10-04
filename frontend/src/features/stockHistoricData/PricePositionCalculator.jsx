import { useState, useEffect, useTransition, useRef } from 'react';
import ZScoreChart from './ZScoreChart.jsx';
import { fetchUniqueStockTickers } from '../../services/b3service.js';
import { fetchWalletPositions } from '../../services/walletDataService.js';
import { analysisService } from '../../services/api.js';

const MAX_MONTHS = 60;

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

function PricePositionCalculator() {
  const [selectedTicker, setSelectedTicker] = useState('');
  const [tickerList, setTickerList] = useState([]);
  const [walletTickers, setWalletTickers] = useState([]);
  const [walletZScores, setWalletZScores] = useState({});
  const [isLoadingWalletZScores, setIsLoadingWalletZScores] = useState(false);

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
      setWalletZScores({});
      return undefined;
    }

    let isMounted = true;
    setIsLoadingWalletZScores(true);

    Promise.all(
      walletTickers.map(async (position) => {
        try {
          const data = await analysisService.getZScore(position.ticker, deferredTimeWindow);
          return [position.ticker, data.stats.zScore];
        } catch {
          return [position.ticker, null];
        }
      })
    ).then((scores) => {
      if (!isMounted) return;

      setWalletZScores(Object.fromEntries(scores));
      setIsLoadingWalletZScores(false);
    });

    return () => {
      isMounted = false;
    };
  }, [walletTickers, deferredTimeWindow]);

  useEffect(() => {
    let isMounted = true;

    async function loadWalletTickers() {
      const positions = await fetchWalletPositions();
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
    }

    loadWalletTickers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTicker) return;

    const fetchData = async () => {
      setLoading(true);
      setErrorMessage('');
      setResult(null);
      setChartData([]);

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
  }, [selectedTicker, deferredTimeWindow]);

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
    <div className="p-8 max-w-6xl">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
        Analisador PRO (Z-Score / Desvio Padrão)
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)] gap-6 items-start">
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

          {loading && (
            <div className="mt-6 text-center text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
              Processando estatísticas no servidor...
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

          <div className="text-gray-800 dark:text-gray-300 space-y-1">
            <p>
              <strong className="text-gray-900 dark:text-white">Preço atual:</strong> R${' '}
              {result.current}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Média:</strong> R$ {result.media}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Z-Score:</strong> {result.zScore}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Range:</strong> R$ {result.min} -{' '}
              {result.max}
            </p>

            <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
              O preço esteve menor ou igual ao atual em{' '}
              <strong className="text-gray-900 dark:text-white">{result.percentile}%</strong> dos
              dias.
            </p>

            <p className="mt-4 text-xl font-bold text-gray-900 dark:text-white">{result.status}</p>
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

          {walletTickers.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Ticker</th>
                    <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {isLoadingWalletZScores ? 'Z-Score…' : 'Z-Score'}
                    </th>
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
                        {walletZScores[position.ticker] ?? '—'}
                      </td>
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
