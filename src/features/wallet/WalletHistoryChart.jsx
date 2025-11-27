import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useTheme } from '../theme/ThemeContext.jsx';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}`;
};

const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (active && payload && payload.length) {
    const bgClass = isDark
      ? 'bg-gray-800 border-gray-600 text-gray-200'
      : 'bg-white border-gray-300 text-gray-700';

    return (
      <div className={`${bgClass} border p-3 rounded-lg shadow-lg text-sm z-50`}>
        <p className="font-bold mb-2">{formatDate(label)}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="flex justify-between gap-4">
            <span>{entry.name}:</span>
            <span className="font-mono font-bold">{formatCurrency(entry.value)}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function WalletHistoryChart({ data, benchmarkName = 'Benchmark' }) {
  const themeContext = tryUseTheme();
  const isDark = themeContext === 'dark';

  const gridColor = isDark ? '#374151' : '#e0e0e0';
  const textColor = isDark ? '#9ca3af' : '#666666';

  return (
    <div style={{ width: '100%', height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

          <XAxis
            dataKey="trade_date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: textColor }}
            minTickGap={40}
          />

          <YAxis
            tickFormatter={(val) => `R$${val}`}
            tick={{ fontSize: 12, fill: textColor }}
            width={70}
            domain={['auto', 'auto']}
          />

          <Tooltip content={<CustomTooltip isDark={isDark} />} />
          <Legend />

          <Area
            type="monotone"
            dataKey="portfolio_value"
            name="Valor da Categoria"
            stroke="#2563eb"
            fillOpacity={1}
            fill="url(#colorValue)"
            strokeWidth={3}
          />

          {}
          <Line
            type="monotone"
            dataKey="benchmark_value"
            name={benchmarkName}
            stroke="#eab308"
            strokeDasharray="3 3"
            dot={false}
          />

          <Line
            type="monotone"
            dataKey="invested_amount"
            name="Valor Investido"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function tryUseTheme() {
  try {
    const { theme } = useTheme();
    return theme;
  } catch (e) {
    return 'dark';
  }
}

export default WalletHistoryChart;
