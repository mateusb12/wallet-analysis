import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { formatCurrency, formatCurrencyMobile, useMediaQuery } from '../../utils/chartUtils.js';

const parseNum = (str) => (typeof str === 'string' ? parseFloat(str.replace(',', '.')) : str);

function ZScoreChart({ historicalPrices, analysisResult }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const theme = useMemo(() => {
    return isDark
      ? {
          grid: '#374151',
          text: '#9ca3af',
          line: '#60a5fa',
          currentLine: '#c084fc',
          currentLabel: '#e9d5ff',
          meanLine: '#fb923c',
          meanLabel: '#fdba74',
          tooltipBg: '#1f2937',
          tooltipBorder: '#374151',
          tooltipText: '#f3f4f6',
          areas: {
            veryCheap: { fill: '#064e3b', label: '#6ee7b7' },
            cheap: { fill: '#065f46', label: '#6ee7b7' },
            neutral: { fill: '#1e3a8a', label: '#93c5fd' },
            expensive: { fill: '#7f1d1d', label: '#fca5a5' },
            veryExpensive: { fill: '#991b1b', label: '#fca5a5' },
            opacity: 0.4,
          },
        }
      : {
          grid: '#e0e0e0',
          text: '#666666',
          line: '#2563eb',
          currentLine: '#7e22ce',
          currentLabel: '#581c87',
          meanLine: '#f97316',
          meanLabel: '#a15200',
          tooltipBg: '#ffffff',
          tooltipBorder: '#e5e7eb',
          tooltipText: '#333333',
          areas: {
            veryCheap: { fill: '#bbf7d0', label: '#064e3b' },
            cheap: { fill: '#dcfce7', label: '#052e16' },
            neutral: { fill: '#e0f2fe', label: '#1e3a8a' },
            expensive: { fill: '#fee2e2', label: '#7f1d1d' },
            veryExpensive: { fill: '#fecaca', label: '#991b1b' },
            opacity: 0.6,
          },
        };
  }, [isDark]);

  const yAxisFormatter = (value) =>
    isMobile ? formatCurrencyMobile(value) : formatCurrency(value);

  const { chartData, boundaries, isLongPeriod } = useMemo(() => {
    if (!analysisResult || !historicalPrices || historicalPrices.length === 0) {
      return { chartData: [], boundaries: {}, isLongPeriod: false };
    }

    const mean = parseNum(analysisResult.media);
    const std = parseNum(analysisResult.desvio);
    const current = parseNum(analysisResult.current);
    const min = parseNum(analysisResult.min);
    const max = parseNum(analysisResult.max);

    const b = {
      mean,
      current,
      min,
      max,
      minusTwoStdDev: mean - 2 * std,
      minusOneStdDev: mean - 1 * std,
      plusOneStdDev: mean + 1 * std,
      plusTwoStdDev: mean + 2 * std,
    };

    const firstDate = new Date(historicalPrices[0].date);
    const lastDate = new Date(historicalPrices[historicalPrices.length - 1].date);
    const diffTime = Math.abs(lastDate - firstDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const longPeriod = diffDays > 365;

    const data = historicalPrices.map((d) => {
      const dateObj = new Date(d.date);
      return {
        timestamp: d.date,
        shortDate: dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        longDate: dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        fullDate: dateObj.toLocaleDateString('pt-BR'),
        price: d.close,
      };
    });

    return { chartData: data, boundaries: b, isLongPeriod: longPeriod };
  }, [historicalPrices, analysisResult]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: theme.tooltipBg,
            border: `1px solid ${theme.tooltipBorder}`,
            padding: '10px',
            borderRadius: '8px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          }}
        >
          <p style={{ color: theme.tooltipText, fontWeight: 'bold', marginBottom: '5px' }}>
            {payload[0].payload.fullDate}
          </p>
          <p style={{ color: theme.line, margin: 0 }}>Preço: {formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (!chartData.length) return null;

  const yDomain = [boundaries.min * 0.95, boundaries.max * 1.05];

  return (
    <div style={{ width: '100%', height: 450 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: isMobile ? 0 : 20,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />

          <XAxis
            dataKey={isLongPeriod ? 'longDate' : 'shortDate'}
            minTickGap={40}
            tick={{ fontSize: 11, fill: theme.text }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={yDomain}
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 11, fill: theme.text }}
            tickLine={false}
            axisLine={false}
            width={isMobile ? 55 : 70}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: theme.text, strokeWidth: 1, strokeDasharray: '4 4' }}
          />

          <Legend wrapperStyle={{ paddingTop: '10px' }} />

          {}

          <ReferenceArea
            y1={boundaries.minusTwoStdDev}
            y2={boundaries.minusOneStdDev}
            label={{
              value: 'Barato (Z: -1 a -2)',
              position: 'insideTopLeft',
              fill: theme.areas.cheap.label,
              fontSize: 12,
              opacity: 0.9,
            }}
            fill={theme.areas.cheap.fill}
            fillOpacity={theme.areas.opacity}
            ifOverflow="extendDomain"
          />

          <ReferenceArea
            y1={yDomain[0]}
            y2={boundaries.minusTwoStdDev}
            label={{
              value: 'Muito Barato (Z: < -2)',
              position: 'insideTopLeft',
              fill: theme.areas.veryCheap.label,
              fontSize: 12,
              opacity: 0.9,
            }}
            fill={theme.areas.veryCheap.fill}
            fillOpacity={theme.areas.opacity}
            ifOverflow="extendDomain"
          />

          <ReferenceArea
            y1={boundaries.minusOneStdDev}
            y2={boundaries.plusOneStdDev}
            label={{
              value: 'Zona Neutra (Z: -1 a +1)',
              position: 'insideTopLeft',
              fill: theme.areas.neutral.label,
              fontSize: 12,
              opacity: 0.8,
            }}
            fill={theme.areas.neutral.fill}
            fillOpacity={theme.areas.opacity}
            ifOverflow="extendDomain"
          />

          <ReferenceArea
            y1={boundaries.plusOneStdDev}
            y2={boundaries.plusTwoStdDev}
            label={{
              value: 'Caro (Z: +1 a +2)',
              position: 'insideTopLeft',
              fill: theme.areas.expensive.label,
              fontSize: 12,
              opacity: 0.9,
            }}
            fill={theme.areas.expensive.fill}
            fillOpacity={theme.areas.opacity}
            ifOverflow="extendDomain"
          />

          <ReferenceArea
            y1={boundaries.plusTwoStdDev}
            y2={yDomain[1]}
            label={{
              value: 'Muito Caro (Z: > +2)',
              position: 'insideTopLeft',
              fill: theme.areas.veryExpensive.label,
              fontSize: 12,
              opacity: 0.9,
            }}
            fill={theme.areas.veryExpensive.fill}
            fillOpacity={theme.areas.opacity}
            ifOverflow="extendDomain"
          />

          {}

          <ReferenceLine
            y={boundaries.mean}
            stroke={theme.meanLine}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            label={{
              value: 'Média',
              position: 'insideRight',
              fill: theme.meanLabel,
              fontSize: 10,
            }}
          />

          <Line
            type="monotone"
            dataKey="price"
            name="Preço Histórico"
            stroke={theme.line}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />

          <ReferenceLine
            y={boundaries.current}
            stroke={theme.currentLine}
            strokeWidth={2}
            label={{
              value: 'Atual',
              position: 'insideRight',
              fill: theme.currentLabel,
              fontSize: 10,
              fontWeight: 'bold',
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ZScoreChart;
