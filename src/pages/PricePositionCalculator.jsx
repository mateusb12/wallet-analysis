import { useState } from 'react';

const STOCKS = [
  { id: 'VALE3', label: 'Vale (VALE3)' },
  { id: 'PETR4', label: 'Petrobras PN (PETR4)' },
  { id: 'ITUB4', label: 'Itaú Unibanco PN (ITUB4)' },
  { id: 'MGLU3', label: 'Magazine Luiza (MGLU3)' },
];

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  const m = mean(arr);
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function PricePositionCalculator() {
  const [selected, setSelected] = useState(STOCKS[0].id);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const analyze = async () => {
    setLoading(true);
    setErrorMessage('');
    setResult(null);

    try {
      const response = await fetch(`https://brapi.dev/api/quote/${selected}?range=1y&interval=1d`);

      if (!response.ok) {
        throw new Error('Erro ao buscar dados na BRAPI');
      }

      const json = await response.json();

      if (!json.results || json.results.length === 0) {
        throw new Error('Nenhum dado retornado para este ticker');
      }

      const apiResult = json.results[0];

      const prices = (apiResult.historicalDataPrice || [])
        .map((d) => d.close)
        .filter((v) => typeof v === 'number' && !Number.isNaN(v));

      if (!prices.length) {
        throw new Error('Histórico sem preços válidos');
      }

      const currentPrice =
        typeof apiResult.regularMarketPrice === 'number'
          ? apiResult.regularMarketPrice
          : prices[prices.length - 1];

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
    } catch (err) {
      setErrorMessage(err.message || 'Erro inesperado ao processar dados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">
        Analisador PRO (Z-Score / Desvio Padrão)
      </h2>

      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-700 mb-6">
          Este módulo usa o histórico de aproximadamente 1 ano da ação selecionada (dados da BRAPI)
          para calcular <strong>média, desvio padrão e Z-Score</strong>, além de posição no range de
          preços e percentil. Isso te dá uma noção de quão <strong>esticado ou descontado</strong> o
          preço atual está em relação ao comportamento recente.
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-2">Selecione a ação:</label>

        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
        >
          {STOCKS.map((stock) => (
            <option key={stock.id} value={stock.id}>
              {stock.label}
            </option>
          ))}
        </select>

        <button
          onClick={analyze}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg"
        >
          {loading ? 'Calculando...' : 'Calcular Z-Score'}
        </button>

        {errorMessage && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{errorMessage}</div>
        )}

        {result && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 text-gray-700">Resultado:</h3>

            <p>
              <strong>Preço atual:</strong> R$ {result.current}
            </p>
            <p>
              <strong>Mínimo no período (~1 ano):</strong> R$ {result.min}
            </p>
            <p>
              <strong>Máximo no período (~1 ano):</strong> R$ {result.max}
            </p>
            <p>
              <strong>Média no período (~1 ano):</strong> R$ {result.media}
            </p>
            <p>
              <strong>Desvio padrão:</strong> {result.desvio}
            </p>
            <p>
              <strong>Z-Score:</strong> {result.zScore}
            </p>

            {result.positionPct !== null && (
              <p>
                <strong>Posição no range de 1 ano:</strong> {result.positionPct}% (0% = na mínima,
                100% = na máxima)
              </p>
            )}

            <p className="mt-2 text-sm text-gray-700">
              Em {result.daysBelowOrEqual} de {result.totalDays} pregões ({result.percentile}% do
              tempo), o preço esteve <strong>menor ou igual</strong> ao preço atual.
            </p>

            <p className="mt-4 text-xl font-bold">{result.status}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PricePositionCalculator;
