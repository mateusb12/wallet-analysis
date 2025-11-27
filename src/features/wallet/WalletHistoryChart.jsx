import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
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

const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (active && payload && payload.length) {
    const bgClass = isDark
      ? 'bg-gray-800 border-gray-600 text-gray-200'
      : 'bg-white border-gray-300 text-gray-700';

    const benchmarkEntry = payload.find((p) => p.dataKey === 'benchmark_value');
    const investedEntry = payload.find((p) => p.dataKey === 'invested_amount');

    const benchmarkVal = benchmarkEntry ? benchmarkEntry.value : 0;
    const investedVal = investedEntry ? investedEntry.value : 0;

    const ratio = investedVal > 0 ? (investedVal - benchmarkVal) / investedVal : 0;

    return (
      <div className={`${bgClass} border p-3 rounded-lg shadow-lg text-sm z-50`}>
        <p className="font-bold mb-2 border-b border-gray-500/20 pb-1">{formatDate(label)}</p>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between gap-6 items-center">
            <span style={{ color: '#eab308' }} className="font-medium text-xs">
              {benchmarkEntry?.name || 'Benchmark'}:
            </span>
            <span className="font-mono font-bold text-sm">{formatCurrency(benchmarkVal)}</span>
          </div>

          <div className="flex justify-between gap-6 items-center">
            <span style={{ color: '#16a34a' }} className="font-medium text-xs">
              Valor Investido:
            </span>
            <span className="font-mono font-bold text-sm">{formatCurrency(investedVal)}</span>
          </div>

          <div className="flex justify-end mt-1 pt-1 border-t border-gray-500/20">
            <span className="text-[10px] text-gray-400 mr-2 self-center">Diff (Inv vs Bench):</span>
            <span className={`text-xs font-bold ${ratio >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {ratio >= 0 ? '+' : ''}
              {formatPercent(ratio)}
            </span>
          </div>
        </div>
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
    return [...data].sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
  }, [data]);

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

  return (
    <div style={{ width: '100%', height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
            </linearGradient>

            <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
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

          <Legend
            payload={[
              { value: benchmarkName, type: 'rect', color: '#eab308' },
              { value: 'Valor Investido', type: 'rect', color: '#16a34a' },
            ]}
          />

          <Area
            type="monotone"
            dataKey="benchmark_value"
            name={benchmarkName}
            stroke="#eab308"
            strokeWidth={2}
            fill="url(#colorBenchmark)"
            fillOpacity={1}
            connectNulls={false}
          />

          <Area
            type="monotone"
            dataKey="invested_amount"
            name="Valor Investido"
            stroke="#16a34a"
            strokeWidth={2}
            fill="url(#colorInvested)"
            fillOpacity={1}
            connectNulls={false}
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
