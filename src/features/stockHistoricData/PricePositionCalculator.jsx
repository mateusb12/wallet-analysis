import { useState, useEffect, useTransition } from 'react';
import ZScoreChart from './ZScoreChart.jsx';

const STOCKS = [
  { id: 'VALE3', label: 'Vale (VALE3)' },
  { id: 'PETR4', label: 'Petrobras PN (PETR4)' },
  { id: 'ITUB4', label: 'Itaú Unibanco PN (ITUB4)' },
  { id: 'MGLU3', label: 'Magazine Luiza (MGLU3)' },
];

const TRADING_DAYS_PER_MONTH = 21;
const MAX_MONTHS = 60;

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  const m = mean(arr);
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function getWindowLabel(months) {
  if (months < 12) return `(${months} meses)`;
  if (months === 12) return `(~1 ano)`;
  if (months % 12 === 0) return `(${months / 12} anos)`;
  return `(${months} meses)`;
}

function PricePositionCalculator() {
  const [selected, setSelected] = useState(STOCKS[0].id);
  const [result, setResult] = useState(null);
  const [timeWindowInMonths, setTimeWindowInMonths] = useState(12);
  const [deferredTimeWindow, setDeferredTimeWindow] = useState(12);
  const [isPending, startTransition] = useTransition();
  const [windowLabel, setWindowLabel] = useState('(~1 ano)');
  const [chartData, setChartData] = useState([]);

  const [fullHistoricalData, setFullHistoricalData] = useState([]);

  const [currentPrice, setCurrentPrice] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMessage('');
      setResult(null);
      setFullHistoricalData([]);
      setCurrentPrice(null);

      try {
        const response = await fetch(
          `https://brapi.dev/api/quote/${selected}?range=5y&interval=1d`
        );

        if (!response.ok) {
          throw new Error('Erro ao buscar dados na BRAPI');
        }

        const json = await response.json();

        if (!json.results || json.results.length === 0) {
          throw new Error('Nenhum dado retornado para este ticker');
        }

        const apiResult = json.results[0];

        const allPricesData = (apiResult.historicalDataPrice || [])
          .map((d) => ({ date: d.date, close: d.close }))
          .filter((d) => typeof d.close === 'number' && !Number.isNaN(d.close));

        if (!allPricesData.length) {
          throw new Error('Histórico sem preços válidos');
        }

        setFullHistoricalData(allPricesData);

        const price =
          typeof apiResult.regularMarketPrice === 'number'
            ? apiResult.regularMarketPrice
            : allPricesData[allPricesData.length - 1].close;

        setCurrentPrice(price);
      } catch (err) {
        setErrorMessage(err.message || 'Erro inesperado ao processar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selected]);

  useEffect(() => {
    if (fullHistoricalData.length === 0 || !currentPrice) {
      setResult(null);
      return;
    }

    try {
      const tradingDaysInWindow = Math.round(timeWindowInMonths * TRADING_DAYS_PER_MONTH);
      const filteredData = fullHistoricalData.slice(-tradingDaysInWindow);

      if (filteredData.length === 0) {
        setResult(null);
        setChartData([]);
        return;
      }

      setChartData(filteredData);

      const prices = filteredData.map((d) => d.close);
      const media = mean(prices);
      const desvio = stdDev(prices);
      const z = desvio === 0 ? 0 : (currentPrice - media) / desvio;

      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const range = maxPrice - minPrice;

      let positionPct = null;
      if (range !== 0) {
        positionPct = ((currentPrice - minPrice) / range) * 100;
        positionPct = Math.max(0, Math.min(100, positionPct));
      }

      const daysBelowOrEqual = prices.filter((p) => p <= currentPrice).length;
      const percentile = (daysBelowOrEqual / prices.length) * 100;

      let status;
      if (desvio === 0) {
        status = 'Histórico sem variação suficiente para calcular Z-Score (desvio padrão = 0).';
      } else if (z <= -2) {
        status = '🔥 Muito barato (Z ≤ -2)';
      } else if (z <= -1) {
        status = '✅ Barato (−2 < Z ≤ −1)';
      } else if (z < 1) {
        status = '➖ Zona neutra (−1 < Z < 1)';
      } else if (z < 2) {
        status = '⚠️ Caro (1 ≤ Z < 2)';
      } else {
        status = '❌ Muito caro (Z ≥ 2)';
      }

      setWindowLabel(getWindowLabel(timeWindowInMonths));

      setResult({
        current: currentPrice.toFixed(2),
        media: media.toFixed(2),
        desvio: desvio.toFixed(2),
        zScore: z.toFixed(2),
        min: minPrice.toFixed(2),
        max: maxPrice.toFixed(2),
        positionPct: positionPct !== null ? positionPct.toFixed(1) : null,
        daysBelowOrEqual,
        totalDays: prices.length,
        percentile: percentile.toFixed(1),
        status,
      });
      setErrorMessage('');
    } catch (err) {
      setErrorMessage('Erro ao calcular Z-Score para esta janela.');
      setResult(null);
    }
  }, [deferredTimeWindow, fullHistoricalData, currentPrice]);

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
        Analisador PRO (Z-Score / Desvio Padrão)
      </h2>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors duration-200">
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Use o slider para ajustar a janela de análise (1-60 meses) e veja o cálculo do Z-Score ser
          atualizado instantaneamente. Os dados de 5 anos são carregados uma vez por ação.
        </p>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Selecione a ação:
        </label>

        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-6 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {STOCKS.map((stock) => (
            <option key={stock.id} value={stock.id} className="dark:bg-gray-700">
              {stock.label}
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Janela de Análise:{' '}
          <span className="font-bold text-gray-900 dark:text-white">
            {timeWindowInMonths} meses
          </span>
        </label>
        <input
          type="range"
          min="1"
          max={MAX_MONTHS}
          step="1"
          value={timeWindowInMonths}
          onChange={(e) => {
            const newValue = Number(e.target.value);
            setTimeWindowInMonths(newValue);
            startTransition(() => {
              setDeferredTimeWindow(newValue);
            });
          }}
          disabled={loading || !fullHistoricalData.length}
          className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer mt-2 mb-4 accent-blue-600"
        />
      </div>

      {loading && (
        <div className="mt-6 text-center text-blue-600 dark:text-blue-400 font-semibold">
          Carregando dados de 5 anos...
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
            Resultado para {windowLabel}:
          </h3>

          <div className="text-gray-800 dark:text-gray-300 space-y-1">
            <p>
              <strong className="text-gray-900 dark:text-white">Preço atual:</strong> R${' '}
              {result.current}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">
                Mínimo no período {windowLabel}:
              </strong>{' '}
              R$ {result.min}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">
                Máximo no período {windowLabel}:
              </strong>{' '}
              R$ {result.max}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">
                Média no período {windowLabel}:
              </strong>{' '}
              R$ {result.media}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Desvio padrão:</strong>{' '}
              {result.desvio}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Z-Score:</strong> {result.zScore}
            </p>

            {result.positionPct !== null && (
              <p>
                <strong className="text-gray-900 dark:text-white">
                  Posição no range {windowLabel}:
                </strong>{' '}
                {result.positionPct}% (0% = na mínima, 100% = na máxima)
              </p>
            )}

            <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
              Em {result.daysBelowOrEqual} de {result.totalDays} pregões {windowLabel} (
              {result.percentile}% do tempo), o preço esteve{' '}
              <strong className="text-gray-900 dark:text-white">menor ou igual</strong> ao preço
              atual.
            </p>

            <p className="mt-4 text-xl font-bold text-gray-900 dark:text-white">{result.status}</p>
          </div>
        </div>
      )}

      {!loading && result && chartData.length > 0 && (
        <div className={`mt-8 ${isPending ? 'opacity-60 transition-opacity' : ''}`}>
          <h3 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
            Visualização Gráfica {windowLabel}
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 pt-8 transition-colors duration-200">
            <ZScoreChart
              key={deferredTimeWindow}
              historicalPrices={chartData}
              analysisResult={result}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default PricePositionCalculator;
