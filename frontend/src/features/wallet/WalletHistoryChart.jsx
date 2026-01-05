import React, { useMemo, useState, useEffect } from 'react';
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

const PurchaseDot = (props) => {
  const { cx, cy, payload, isDark } = props;

  if (payload && payload.purchaseEvents && payload.purchaseEvents.length > 0) {
    const strokeColor = isDark ? '#1f2937' : '#ffffff';

    const size = 18;
    const radius = 6;
    const borderSize = 3;

    return (
      <svg
        x={cx - size / 2}
        y={cy - size / 2}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="#3b82f6"
          stroke={strokeColor}
          strokeWidth={borderSize}
        />
      </svg>
    );
  }
  return null;
};

const CustomTooltip = ({ active, payload, label, isDark, selectedDate }) => {
  if (active && payload && payload.length) {
    const bgClass = isDark
      ? 'bg-gray-800 border-gray-600 text-gray-200'
      : 'bg-white border-gray-300 text-gray-700';

    const benchmarkEntry = payload.find((p) => p.dataKey === 'benchmark_value');
    const portfolioEntry = payload.find((p) => p.dataKey === 'portfolio_value');

    const benchmarkVal = benchmarkEntry ? benchmarkEntry.value : 0;
    const portfolioVal = portfolioEntry ? portfolioEntry.value : 0;
    const ratio = portfolioVal > 0 ? (portfolioVal - benchmarkVal) / portfolioVal : 0;

    const purchaseEvents = payload[0].payload.purchaseEvents || [];
    const isSelected = label === selectedDate;

    // --- CÁLCULOS ---
    const totalPurchaseValue = purchaseEvents.reduce(
      (acc, curr) => acc + curr.qty * curr.purchase_price,
      0
    );
    const prePurchasePortfolio = portfolioVal - totalPurchaseValue;
    const impactPercent = prePurchasePortfolio > 0 ? totalPurchaseValue / prePurchasePortfolio : 0;
    // ----------------

    return (
      <div className={`${bgClass} border p-3 rounded-lg shadow-lg text-sm z-50`}>
        <p className="font-bold mb-2 border-b border-gray-500/20 pb-1">{formatChartDate(label)}</p>

        {purchaseEvents.length > 0 && (
          <div className="mb-3 pb-2 border-b border-gray-500/20 bg-blue-50 dark:bg-blue-900/20 -mx-3 px-3 py-2">
            {/* Cabeçalho Limpo (sem o card de %) */}
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Evento de Compra {purchaseEvents[0].isApproximate && '(Aprox.)'}
            </p>

            {/* Lista de compras */}
            {purchaseEvents.map((event, idx) => {
              const itemTotal = event.qty * event.purchase_price;
              return (
                <div
                  key={idx}
                  className="text-xs text-gray-700 dark:text-gray-300 mb-1 last:mb-0 flex flex-col"
                >
                  <div>
                    <span className="font-bold">{event.ticker}</span>: x{event.qty} por {''}
                    {formatCurrency(event.purchase_price)}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 pl-2">
                    ↳ Total: {formatCurrency(itemTotal)}
                  </div>
                </div>
              );
            })}

            {/* Rodapé com Total e Impacto (Sempre visível agora) */}
            <div className="mt-2 pt-1 border-t border-blue-200 dark:border-blue-800 text-xs text-right text-blue-600 dark:text-blue-300">
              <span className="font-bold">Total Aportado: </span>
              {formatCurrency(totalPurchaseValue)}
              <span className="ml-1 opacity-90 font-normal">
                ({ratio >= 0 ? '+' : ''}
                {formatPercent(impactPercent)} no Patr.)
              </span>
            </div>
          </div>
        )}

        {/* Resto do Tooltip (Patrimônio vs Benchmark) */}
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

          <div className="mt-2 pt-2 border-t border-gray-500/20 text-center animate-pulse">
            {isSelected ? (
              <p className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wide">
                Clique novamente para ver tabela
              </p>
            ) : (
              <p className="text-[10px] text-gray-400">Clique para selecionar</p>
            )}
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
  onPointClick,
}) {
  const themeContext = tryUseTheme();
  const isDark = themeContext === 'dark';
  const [selectedDate, setSelectedDate] = useState(null);

  const hasData = Array.isArray(data) && data.length > 0;

  // --- DEBUGGING LOGS ---
  useEffect(() => {
    console.group('🔍 DEBUG CHART DATA (WalletHistoryChart)');
    console.log('1. Raw Data received (len):', data?.length);

    if (data && data.length > 0) {
      const firstItem = data[0];
      const lastItem = data[data.length - 1];

      console.log('2. Sample Item (First):', firstItem);
      console.log('3. Sample Item (Last):', lastItem);
      console.log('4. Fields found in object:', Object.keys(firstItem));

      // Verificação crucial: O gráfico espera 'portfolio_value' e 'benchmark_value'.
      // Vamos avisar se eles não existirem.
      if (firstItem.portfolio_value === undefined && firstItem.close !== undefined) {
        console.warn(
          '⚠️ ALERTA: O objeto tem "close" mas o gráfico espera "portfolio_value". O gráfico ficará vazio.'
        );
      }
      if (firstItem.benchmark_value === undefined) {
        console.warn('⚠️ ALERTA: O campo "benchmark_value" está ausente.');
      }
    } else {
      console.warn('❌ Data is empty or undefined');
    }

    if (purchaseEvents && purchaseEvents.length > 0) {
      console.log('5. Purchase Events:', purchaseEvents);
    }
    console.groupEnd();
  }, [data, purchaseEvents]);
  // ----------------------

  const processedData = useMemo(() => {
    if (!hasData) return [];

    const result = [...data]
      .sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date))
      .map((d) => ({ ...d, purchaseEvents: [] }));

    if (!purchaseEvents || purchaseEvents.length === 0) return result;

    purchaseEvents.forEach((event) => {
      const pDate = new Date(event.purchaseDate);

      let matchIndex = result.findIndex((d) => d.trade_date === event.purchaseDate);

      let isApprox = false;

      if (matchIndex === -1) {
        matchIndex = result.findIndex((d) => {
          const dDate = new Date(d.trade_date);

          return dDate > pDate;
        });
        if (matchIndex !== -1) isApprox = true;
      }

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
        <ComposedChart
          data={processedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          onClick={(state) => {
            if (state && state.activePayload && state.activePayload.length > 0) {
              const payload = state.activePayload[0].payload;
              const clickedDate = payload.trade_date;

              if (selectedDate === clickedDate) {
                // Second click on same point: Execute Action
                if (onPointClick && clickedDate) {
                  onPointClick(clickedDate);
                  setSelectedDate(null); // Optional: reset selection after action
                }
              } else {
                // First click: Select
                setSelectedDate(clickedDate);
              }
            }
          }}
          style={{ cursor: 'pointer' }}
        >
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

          <Tooltip content={<CustomTooltip isDark={isDark} selectedDate={selectedDate} />} />

          <Legend
            payload={[
              { value: benchmarkName, type: 'rect', color: '#eab308' },
              { value: 'Patrimônio', type: 'rect', color: '#16a34a' },
              { value: 'Compras', type: 'circle', color: '#2563eb' },
            ]}
          />

          {/* Visual Indicator for Selected Point */}
          {selectedDate && (
            <ReferenceLine x={selectedDate} stroke="#ec4899" strokeDasharray="3 3">
              <Label
                value="Selecionado"
                position="insideTop"
                fill={isDark ? '#fbcfe8' : '#be185d'}
                fontSize={10}
                offset={10}
              />
            </ReferenceLine>
          )}

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
            dot={<PurchaseDot isDark={isDark} />}
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
