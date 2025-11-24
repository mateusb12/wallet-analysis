import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

const formatPrice = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const formatDividend = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year.slice(2)}`;
};

const CustomTooltip = ({ active, payload, label, showTotalReturn }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const yieldValue = data.dividend_yield_month ? data.dividend_yield_month * 100 : 0;
    const ipcaValue = data.ipca_projection ? data.ipca_projection : null;
    const totalReturnValue = data.total_return ? data.total_return : null;

    return (
      <div className="bg-white border border-gray-300 p-3 rounded-lg shadow-lg text-sm z-50">
        <p className="font-bold text-gray-700 mb-2 border-b border-gray-100 pb-1">
          {formatDate(label)}
        </p>

        <div className="space-y-1">
          {}
          {showTotalReturn && totalReturnValue && (
            <p className="text-purple-700 flex justify-between gap-4 font-bold bg-purple-50 px-1 rounded">
              <span>Retorno Total:</span>
              <span className="font-mono">{formatPrice(totalReturnValue)}</span>
            </p>
          )}

          <p className="text-orange-600 flex justify-between gap-4">
            <span>IPCA (Base 1º dia):</span>
            <span className="font-mono">{formatPrice(ipcaValue)}</span>
          </p>

          <div className="my-1 border-t border-gray-100"></div>

          <p className="text-blue-600 flex justify-between gap-4">
            <span>Preço Cota:</span>
            <span className="font-mono">{formatPrice(data.price_close)}</span>
          </p>

          <p className="text-green-600 flex justify-between gap-4">
            <span>Dividendos:</span>
            <span className="font-mono">{formatDividend(data.dividend_value)}</span>
          </p>

          <p className="text-purple-600 flex justify-between gap-4 font-semibold mt-1 pt-1 border-t border-gray-100">
            <span>Yield:</span>
            <span className="font-mono">{yieldValue.toFixed(2)}%</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

function HistoryChart({ data, showTotalReturn }) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const chartData = [...data].reverse();

  return (
    <div style={{ width: '100%', height: 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{
            top: 20,
            right: 0,
            bottom: 20,
            left: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />

          <XAxis
            dataKey="trade_date"
            tickFormatter={formatDate}
            minTickGap={30}
            tick={{ fontSize: 12 }}
          />

          <YAxis
            yAxisId="left"
            width={isMobile ? 40 : 60}
            domain={['auto', 'auto']}
            tickFormatter={(val) => (isMobile ? val : formatPrice(val))}
            style={{ fontSize: '11px' }}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            width={isMobile ? 40 : 60}
            domain={[0, 'auto']}
            tickFormatter={(val) => (isMobile ? val : formatDividend(val))}
            style={{ fontSize: '11px' }}
          />

          {}
          <Tooltip content={<CustomTooltip showTotalReturn={showTotalReturn} />} />

          <Legend wrapperStyle={{ paddingTop: '10px' }} />

          <Bar
            yAxisId="right"
            dataKey="dividend_value"
            name="Dividendos"
            fill="#82ca9d"
            barSize={20}
            opacity={0.4}
          />

          {}
          {showTotalReturn && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="total_return"
              name="Retorno Total (Cota+Div)"
              stroke="#7e22ce"
              strokeWidth={3}
              dot={false}
              animationDuration={500}
            />
          )}

          <Line
            yAxisId="left"
            type="stepAfter"
            dataKey="ipca_projection"
            name="Inflação Acumulada (IPCA)"
            stroke="#ea580c"
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={false}
          />

          <Line
            yAxisId="left"
            type="monotone"
            dataKey="price_close"
            name="Preço Fechamento"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default HistoryChart;
