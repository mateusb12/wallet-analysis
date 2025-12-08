import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const tooltipFormatter = (value, name) => {
  if (name === 'Valor Corrigido' || name === 'correctedValue') {
    return [formatCurrency(Number(value.toFixed(2))), 'Valor Corrigido'];
  }

  if (name === 'IPCA (mês)' || name === 'ipca') {
    return [`${Number(value).toFixed(2)}%`, 'IPCA (mês)'];
  }

  return [value, name];
};

const formatFullMonth = (date) =>
  new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);

const formatPercent = (value) => `${value.toFixed(1)}%`;

const CustomXAxisTick = ({ x, y, payload, index, data }) => {
  const isFirstOrLast = index === 0 || index === data.length - 1;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={16}
        textAnchor="middle"
        fill="#666"
        style={{
          opacity: isFirstOrLast ? 0 : 1,
        }}
      >
        {payload.value}
      </text>
    </g>
  );
};

function IpcaChart({ data }) {
  const ipcaValues = data.map((d) => d.ipca);
  const minIpca = Math.min(...ipcaValues);
  const maxIpca = Math.max(...ipcaValues);
  const percentDomain = [Math.floor(minIpca) - 1, Math.ceil(maxIpca) + 1];

  const firstMonth = data[0]?.month;
  const lastMonth = data[data.length - 1]?.month;

  const formatXAxis = (value) => {
    if (value === firstMonth) {
      return 'I';
    }

    if (value === lastMonth) {
      return 'Fim';
    }

    return value.replace('. de ', '/').replace('.', '');
  };

  return (
    <div className="" style={{ width: '100%', height: 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: 40,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />

          <XAxis dataKey="month" tickFormatter={formatXAxis} interval="preserveStartEnd" />

          <YAxis
            yAxisId="left"
            tickFormatter={formatCurrency}
            domain={['auto', 'auto']}
            stroke="#16a34a"
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatPercent}
            domain={percentDomain}
            stroke="#2563eb"
          />

          <Tooltip
            formatter={tooltipFormatter}
            labelFormatter={(label, payload) => {
              if (!payload || !payload[0]) return label;

              const raw = payload[0].payload.refDate;
              if (!raw) return label;

              const [year, month] = raw.split('-').map(Number);
              const dateObj = new Date(Date.UTC(year, month - 1, 1));

              return formatFullMonth(dateObj);
            }}
          />

          <Legend />

          <Line
            yAxisId="left"
            type="monotone"
            dataKey="correctedValue"
            name="Valor Corrigido"
            stroke="#16a34a"
            strokeWidth={2}
            activeDot={{ r: 8 }}
            dot={false}
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="ipca"
            name="IPCA (mês)"
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default IpcaChart;
