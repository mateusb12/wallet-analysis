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
import { formatChartDate } from '../../utils/dateUtils.js';

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

// Custom Dot Component to render purchase points
const PurchaseDot = (props) => {
  const { cx, cy, payload } = props;

  // Only render if this specific data point has purchase events attached
  if (payload && payload.purchaseEvents && payload.purchaseEvents.length > 0) {
    return (
      <svg x={cx - 6} y={cy - 6} width={12} height={12} fill="white" viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="5" fill="#2563eb" stroke="white" strokeWidth="2" />
      </svg>
    );
  }
  return null;
};

const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (active && payload && payload.length) {
    const bgClass = isDark
      ? 'bg-gray-800 border-gray-600 text-gray-200'
      : 'bg-white border-gray-300 text-gray-700';

    const benchmarkEntry = payload.find((p) => p.dataKey === 'benchmark_value');
    const portfolioEntry = payload.find((p) => p.dataKey === 'portfolio_value');

    const benchmarkVal = benchmarkEntry ? benchmarkEntry.value : 0;
    const portfolioVal = portfolioEntry ? portfolioEntry.value : 0;
    const ratio = portfolioVal > 0 ? (portfolioVal - benchmarkVal) / portfolioVal : 0;

    // Extract purchase events from the payload
    const purchaseEvents = payload[0].payload.purchaseEvents || [];

    return (
      <div className={`${bgClass} border p-3 rounded-lg shadow-lg text-sm z-50`}>
        <p className="font-bold mb-2 border-b border-gray-500/20 pb-1">{formatChartDate(label)}</p>

        {/* Render Purchase Details if they exist for this date */}
        {purchaseEvents.length > 0 && (
          <div className="mb-3 pb-2 border-b border-gray-500/20 bg-blue-50 dark:bg-blue-900/20 -mx-3 px-3 py-2">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Evento de Compra {purchaseEvents[0].isApproximate && '(Aprox.)'}
            </p>
            {purchaseEvents.map((event, idx) => (
              <div key={idx} className="text-xs text-gray-700 dark:text-gray-300 mb-0.5 last:mb-0">
                <span className="font-bold">{event.ticker}</span>: {event.qty} un. @{' '}
                {formatCurrency(event.purchase_price)}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <div className="flex justify-between gap-6 items-center">
            <span style={{ color: '#eab308' }} className="font-medium text-xs">
              {benchmarkEntry?.name || 'Benchmark'}:
            </span>
            <span className="font-mono font-bold text-sm">{formatCurrency(benchmarkVal)}</span>
          </div>

          <div className="flex justify-between gap-6 items-center">
            <span style={{ color: '#16a34a' }} className="font-medium text-xs">
              Patrimônio:
            </span>
            <span className="font-mono font-bold text-sm">{formatCurrency(portfolioVal)}</span>
          </div>

          <div className="flex justify-end mt-1 pt-1 border-t border-gray-500/20">
            <span className="text-[10px] text-gray-400 mr-2 self-center">
              Diff (Patr. vs Bench):
            </span>
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

function WalletHistoryChart({
  data = [],
  benchmarkName = 'Benchmark',
  purchaseDate = null,
  purchaseEvents = [],
}) {
  const themeContext = tryUseTheme();
  const isDark = themeContext === 'dark';

  const hasData = Array.isArray(data) && data.length > 0;

  // Process data to merge purchase events, handling missing dates (weekends/holidays)
  const processedData = useMemo(() => {
    if (!hasData) return [];

    // 1. Create a deep copy of data to avoid mutation and ensure sorting
    const result = [...data]
      .sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date))
      .map((d) => ({ ...d, purchaseEvents: [] }));

    if (!purchaseEvents || purchaseEvents.length === 0) return result;

    // 2. Map each event to the exact date OR the next available date
    purchaseEvents.forEach((event) => {
      const pDate = new Date(event.purchaseDate);

      // Try exact match first
      let matchIndex = result.findIndex((d) => d.trade_date === event.purchaseDate);

      let isApprox = false;

      // If no exact match (e.g., purchased on Saturday, or data gap), find closest future date
      if (matchIndex === -1) {
        matchIndex = result.findIndex((d) => {
          const dDate = new Date(d.trade_date);
          // Check if data date is AFTER purchase date
          return dDate > pDate;
        });
        if (matchIndex !== -1) isApprox = true;
      }

      // If we found a valid point (exact or next available), attach the event
      if (matchIndex !== -1) {
        result[matchIndex].purchaseEvents.push({ ...event, isApproximate: isApprox });
      }
    });

    return result;
  }, [data, purchaseEvents]);

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
            tickFormatter={formatChartDate}
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
              { value: 'Patrimônio', type: 'rect', color: '#16a34a' },
              { value: 'Compras', type: 'circle', color: '#2563eb' },
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
            dataKey="portfolio_value"
            name="Patrimônio"
            stroke="#16a34a"
            strokeWidth={2}
            fill="url(#colorInvested)"
            fillOpacity={1}
            connectNulls={false}
            dot={<PurchaseDot />}
            activeDot={{ r: 6, strokeWidth: 0 }}
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
