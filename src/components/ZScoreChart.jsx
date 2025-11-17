import React, { useMemo } from 'react';
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
import {
  formatCurrency,
  formatCurrencyMobile,
  tooltipFormatter,
  useMediaQuery,
} from '../utils/chartUtils.js';

const parseNum = (str) => (typeof str === 'string' ? parseFloat(str.replace(',', '.')) : str);

function ZScoreChart({ historicalPrices, analysisResult }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const yAxisFormatter = (value) =>
    isMobile ? formatCurrencyMobile(value) : formatCurrency(value);

  const { chartData, boundaries } = useMemo(() => {
    if (!analysisResult || !historicalPrices) {
      return { chartData: [], boundaries: {} };
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

    const data = historicalPrices.map((d) => ({
      date: new Date(d.date * 1000).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
      price: d.close,
    }));

    return { chartData: data, boundaries: b };
  }, [historicalPrices, analysisResult]);

  const yDomain = [boundaries.min * 0.95, boundaries.max * 1.05];

  return (
    <div className="" style={{ width: '100%', height: 450 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: isMobile ? 10 : 30,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />

          <XAxis dataKey="date" interval={isMobile ? 30 : 15} tick={{ fontSize: 12 }} />

          <YAxis
            domain={yDomain}
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 12 }}
            width={isMobile ? 65 : 80}
          />

          <Tooltip formatter={tooltipFormatter} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />

          {}

          <ReferenceArea
            y1={boundaries.minusTwoStdDev}
            y2={boundaries.minusOneStdDev}
            label={{
              value: 'Barato (Z: -1 a -2)',
              position: 'insideTopLeft',
              fill: '#052e16',
              fontSize: 12,
              opacity: 0.8,
            }}
            fill="#dcfce7"
            fillOpacity={0.6}
            ifOverflow="visible"
          />

          <ReferenceArea
            y1={yDomain[0]}
            y2={boundaries.minusTwoStdDev}
            label={{
              value: 'Muito Barato (Z: < -2)',
              position: 'insideTopLeft',
              fill: '#064e3b',
              fontSize: 12,
              opacity: 0.8,
            }}
            fill="#bbf7d0"
            fillOpacity={0.7}
            ifOverflow="visible"
          />

          <ReferenceArea
            y1={boundaries.minusOneStdDev}
            y2={boundaries.plusOneStdDev}
            label={{
              value: 'Zona Neutra (Z: -1 a +1)',
              position: 'insideTopLeft',
              fill: '#1e3a8a',
              fontSize: 12,
              opacity: 0.6,
            }}
            fill="#e0f2fe"
            fillOpacity={0.4}
            ifOverflow="visible"
          />

          <ReferenceArea
            y1={boundaries.plusOneStdDev}
            y2={boundaries.plusTwoStdDev}
            label={{
              value: 'Caro (Z: +1 a +2)',
              position: 'insideTopLeft',
              fill: '#7f1d1d',
              fontSize: 12,
              opacity: 0.8,
            }}
            fill="#fee2e2"
            fillOpacity={0.6}
            ifOverflow="visible"
          />

          <ReferenceArea
            y1={boundaries.plusTwoStdDev}
            y2={yDomain[1]}
            label={{
              value: 'Muito Caro (Z: > +2)',
              position: 'insideTopLeft',
              fill: '#991b1b',
              fontSize: 12,
              opacity: 0.8,
            }}
            fill="#fecaca"
            fillOpacity={0.7}
            ifOverflow="visible"
          />

          {}

          <ReferenceLine
            y={boundaries.mean}
            label={{ value: `Média: ${formatCurrency(boundaries.mean)}`, fill: '#a15200' }}
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="5 5"
          />

          <Line
            type="monotone"
            dataKey="price"
            name="Preço Histórico"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
          />

          <ReferenceLine
            y={boundaries.current}
            label={{
              value: `Preço Atual: ${formatCurrency(boundaries.current)}`,
              fill: '#581c87',
              position: 'top',
            }}
            stroke="#7e22ce"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ZScoreChart;
