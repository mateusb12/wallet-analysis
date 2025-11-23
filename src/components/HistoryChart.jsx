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

function HistoryChart({ data }) {
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

          <XAxis dataKey="trade_date" tickFormatter={formatDate} minTickGap={30} />

          {}
          <YAxis
            yAxisId="left"
            width={85}
            domain={['auto', 'auto']}
            tickFormatter={(val) => (isMobile ? val : formatPrice(val))}
            style={{ fontSize: '12px' }}
          />

          {}
          <YAxis
            yAxisId="right"
            orientation="right"
            width={85}
            domain={[0, 'auto']}
            tickFormatter={(val) => (isMobile ? val : formatDividend(val))}
            style={{ fontSize: '12px' }}
          />

          <Tooltip
            labelFormatter={(label) => formatDate(label)}
            contentStyle={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #ccc',
            }}
            formatter={(value, name) => {
              if (name === 'Dividendos') {
                return [formatDividend(value), name];
              }
              return [formatPrice(value), name];
            }}
          />
          <Legend />

          <Bar
            yAxisId="right"
            dataKey="dividend_value"
            name="Dividendos"
            fill="#82ca9d"
            barSize={20}
            opacity={0.6}
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
