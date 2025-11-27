import React, { useMemo } from 'react';
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
  ReferenceLine,
  Label,
} from 'recharts';
import { useTheme } from '../theme/ThemeContext.jsx';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const formatPercent = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year.slice(2)}`;
};

const CustomTooltip = ({ active, payload, label, isDark, startValue }) => {
  if (active && payload && payload.length) {
    const bgClass = isDark
      ? 'bg-gray-800 border-gray-600 text-gray-200'
      : 'bg-white border-gray-300 text-gray-700';

    const actualEntry = payload.find((p) => p.dataKey === 'actual_value');
    const theoreticalEntry = payload.find((p) => p.dataKey === 'theoretical_value');

    const mainEntry = actualEntry || theoreticalEntry;
    const value = mainEntry ? mainEntry.value : 0;

    const statusLabel = actualEntry ? 'Carteira (Atual)' : 'Carteira (Simulação)';
    const statusColor = actualEntry ? '#2563eb' : '#9ca3af';

    return (
      <div className={`${bgClass} border p-3 rounded-lg shadow-lg text-sm z-50`}>
        <p className="font-bold mb-2 border-b border-gray-500/20 pb-1">{formatDate(label)}</p>

        <div className="flex flex-col mb-1">
          <div className="flex justify-between gap-6 items-center">
            <span style={{ color: statusColor }} className="font-medium text-xs">
              {statusLabel}:
            </span>
            <span className="font-mono font-bold text-sm">{formatCurrency(value)}</span>
          </div>

          {startValue > 0 && (
            <div className="flex justify-end mt-0.5">
              <span
                className={`text-xs font-bold ${value / startValue - 1 >= 0 ? 'text-green-500' : 'text-red-500'}`}
              >
                {value / startValue - 1 >= 0 ? '+' : ''}
                {formatPercent(value / startValue - 1)}
              </span>
              <span className="text-[10px] text-gray-400 ml-1 self-center">(vs. início)</span>
            </div>
          )}
        </div>

        {payload.map((entry, index) => {
          if (entry.dataKey === 'actual_value' || entry.dataKey === 'theoretical_value')
            return null;

          return (
            <div key={index} className="flex justify-between gap-6 items-center mb-1">
              <span style={{ color: entry.color }} className="font-medium text-xs">
                {entry.name}:
              </span>
              <span className="font-mono font-bold text-sm">{formatCurrency(entry.value)}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

function WalletHistoryChart({ data = [], benchmarkName = 'Benchmark', purchaseDate = null }) {
  const themeContext = tryUseTheme();
  const isDark = themeContext === 'dark';

  const hasData = Array.isArray(data) && data.length > 0;

  const processedData = useMemo(() => {
    if (!hasData) return [];

    const sorted = [...data].sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));

    if (!purchaseDate) {
      return sorted.map((d) => ({
        ...d,
        actual_value: d.portfolio_value,
        theoretical_value: null,
      }));
    }

    const splitTime = new Date(purchaseDate).getTime();

    return sorted.map((item) => {
      const itemTime = new Date(item.trade_date).getTime();

      const isTheoretical = itemTime < splitTime;
      const isActual = itemTime >= splitTime;

      return {
        ...item,
        theoretical_value: isTheoretical ? item.portfolio_value : null,
        actual_value: isActual ? item.portfolio_value : null,
      };
    });
  }, [data, purchaseDate]);

  if (!hasData) {
    return (
      <div
        style={{ width: '100%', height: 350 }}
        className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50"
      >
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Sem dados históricos disponíveis
          </p>
        </div>
      </div>
    );
  }

  const gridColor = isDark ? '#374151' : '#e0e0e0';
  const textColor = isDark ? '#9ca3af' : '#666666';

  const startValue =
    processedData.length > 0
      ? processedData[0].theoretical_value || processedData[0].actual_value || 0
      : 0;

  return (
    <div style={{ width: '100%', height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
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

          <Tooltip content={<CustomTooltip isDark={isDark} startValue={startValue} />} />

          <Legend
            payload={[
              { value: 'Carteira (Atual)', type: 'rect', color: '#2563eb' },
              {
                value: 'Simulação (Pré-Aporte)',
                type: 'line',
                color: '#9ca3af',
                payload: { strokeDasharray: '3 3' },
              },
              { value: benchmarkName, type: 'line', color: '#eab308' },
              { value: 'Valor Investido', type: 'line', color: '#16a34a' },
            ]}
          />

          <Line
            type="monotone"
            dataKey="theoretical_value"
            name="Simulação"
            stroke="#9ca3af"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={false}
            connectNulls={false}
          />

          <Area
            type="monotone"
            dataKey="actual_value"
            name="Carteira Real"
            stroke="#2563eb"
            fillOpacity={1}
            fill="url(#colorActual)"
            strokeWidth={3}
            connectNulls={false}
          />

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

          {purchaseDate && (
            <ReferenceLine x={purchaseDate} stroke="#2563eb" strokeDasharray="3 3" opacity={0.6}>
              <Label
                value="Início Aportes"
                position="insideTopLeft"
                fill={isDark ? '#bfdbfe' : '#1e40af'}
                fontSize={10}
                offset={10}
              />
            </ReferenceLine>
          )}
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
