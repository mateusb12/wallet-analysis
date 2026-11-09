import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { fetchFiiChartData } from '../../services/b3service.js';
import { fetchAssetHealth } from '../../services/walletDataService.js';
import TgarPurchasePanel from './TgarPurchasePanel.jsx';

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const dateLabel = (value) => (value ? value.slice(0, 10).split('-').reverse().join('/') : '—');
const chartDateLabel = (value) => {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  const months = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  return `${day}/${months[Number(month) - 1]} ${year}`;
};
const dayMonthLabel = (value) => chartDateLabel(value).replace(/ \d{4}$/, '');
const money = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const display = (m) =>
  m.unit === 'percent'
    ? `${Number(m.value).toLocaleString('pt-BR')}%`
    : m.unit === 'brl'
      ? money(m.value)
      : m.unit === 'brl_per_share'
        ? `${money(m.value)}/cota`
        : Number(m.value).toLocaleString('pt-BR');
const beforePublication = (timestamp) => {
  if (!timestamp) return null;
  const date = new Date(`${timestamp.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const nextMonthEnd = (value) => {
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  return new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
};

const monthStart = (value) => `${value.slice(0, 7)}-01`;

const monthLabel = (value) => {
  const [year, month] = value.slice(0, 7).split('-');
  const months = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  return `${months[Number(month) - 1]}/${year}`;
};

function GuidanceRangeChart({ minimum, maximum, announced }) {
  const low = Number(minimum);
  const high = Number(maximum);
  const latest = announced === undefined || announced === null ? null : Number(announced);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high < low) return null;

  const axisMax = Math.max(1, Math.ceil(Math.max(high, latest ?? 0) * 2) / 2);
  const position = (value) => `${(value / axisMax) * 100}%`;
  const width = `${((high - low) / axisMax) * 100}%`;

  return (
    <div
      className="mt-5"
      aria-label={`Faixa mensal estimada de ${money(low)} a ${money(high)} por cota`}
    >
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-gray-600/25" />
        <div
          className="absolute top-2 h-4 rounded bg-blue-500/80"
          style={{ left: position(low), width }}
          title={`Faixa estimada: ${money(low)} a ${money(high)}`}
        />
        {latest !== null && Number.isFinite(latest) && (
          <div
            className="absolute top-1 h-6 w-0.5 bg-amber-400"
            style={{ left: position(latest) }}
            title={`Último rendimento anunciado: ${money(latest)}`}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
        <span>R$ 0,00</span>
        <span>{money(axisMax)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
        <span>
          <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-blue-500" />
          Faixa: {money(low)}–{money(high)}
        </span>
        {latest !== null && Number.isFinite(latest) && (
          <span>
            <span className="mr-1 inline-block h-3 w-0.5 bg-amber-400 align-middle" />
            Anunciado: {money(latest)}
          </span>
        )}
      </div>
    </div>
  );
}

function ShareValueBars({ current, previous, currentDate, previousDate }) {
  if (!previous) return null;

  const values = [Number(previous.value), Number(current.value)];
  const max = Math.max(...values, 0.01);
  const scaleMax = Math.max(Math.ceil(max), 1);
  const chartHeight = 128;
  const barHeight = (value) => Math.max((value / scaleMax) * chartHeight, 4);
  const yTicks =
    scaleMax === 1
      ? [1, 0.5, 0]
      : Array.from({ length: scaleMax + 1 }, (_, index) => scaleMax - index);

  return (
    <div className="mt-6" aria-label="Comparação de valores por cota">
      <div className="flex gap-1">
        <div
          className="flex h-[128px] flex-col justify-between text-[10px] text-gray-400"
          aria-hidden="true"
        >
          {yTicks.map((tick) => (
            <span key={tick}>{money(tick)}</span>
          ))}
        </div>
        <div className="flex-1 pr-3">
          <div className="relative flex h-[128px] items-end justify-around border-b border-l border-gray-300 dark:border-gray-600">
            {yTicks.map((tick, index) => (
              <span
                key={`grid-${tick}`}
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gray-400/20"
                style={{ top: `${(index / (yTicks.length - 1)) * 100}%` }}
              />
            ))}
            {[
              {
                label: chartDateLabel(previousDate),
                value: values[0],
                color: 'bg-gray-400 dark:bg-gray-500',
              },
              { label: chartDateLabel(currentDate), value: values[1], color: 'bg-blue-500' },
            ].map((bar) => (
              <div key={bar.label} className="relative flex h-full items-end justify-center">
                <span
                  className="absolute whitespace-nowrap text-[10px] font-medium text-gray-600 dark:text-gray-300"
                  style={{ bottom: `${barHeight(bar.value) + 2}px` }}
                >
                  {money(bar.value)}
                </span>
                <div
                  className={`w-8 rounded-t ${bar.color}`}
                  style={{ height: `${barHeight(bar.value)}px` }}
                  title={`${bar.label}: ${money(bar.value)}/cota`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-around text-[10px] text-gray-500 dark:text-gray-400">
            <span>{chartDateLabel(previousDate)}</span>
            <span>{chartDateLabel(currentDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SharePriceCard({ ticker, referenceDate }) {
  const startDate = referenceDate ? monthStart(referenceDate) : null;
  const endDate = referenceDate ? nextMonthEnd(referenceDate) : null;
  const history = useQuery({
    queryKey: ['fii-price-chart', ticker, startDate, endDate],
    queryFn: () => fetchFiiChartData(ticker, 0, startDate),
    enabled: Boolean(ticker && startDate),
  });

  const points = (history.data || [])
    .map((item) => ({
      date: item.trade_date?.slice(0, 10),
      value: Number(item.close ?? item.price_close),
    }))
    .filter((item) => item.date >= startDate && item.date <= endDate && Number.isFinite(item.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstMonth = referenceDate?.slice(0, 7);
  const secondMonth = endDate?.slice(0, 7);
  const lastOfMonth = (month) => points.filter((point) => point.date.slice(0, 7) === month).at(-1);
  const september = lastOfMonth(firstMonth);
  const october = lastOfMonth(secondMonth);
  const variation =
    september && october && september.value !== 0
      ? (october.value / september.value - 1) * 100
      : null;

  if (history.isPending) {
    return (
      <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Consultando preço da cota...
      </div>
    );
  }

  if (history.error || !september || !october) {
    return (
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">Preço da cota</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Sem histórico de preço disponível para o período.
        </p>
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const tickStep = range <= 20 ? 2.5 : range <= 50 ? 5 : 10;
  const axisMin = Math.floor(min / tickStep) * tickStep;
  const axisMax = Math.ceil(max / tickStep) * tickStep;
  const axisRange = axisMax - axisMin || tickStep;
  const chartWidth = 300;
  const chartHeight = 110;
  const mid = axisMin + axisRange / 2;
  const periodStart = Date.parse(`${startDate}T00:00:00Z`);
  const periodEnd = Date.parse(`${endDate}T00:00:00Z`);
  const xPosition = (date) =>
    ((Date.parse(`${date}T00:00:00Z`) - periodStart) / (periodEnd - periodStart)) * chartWidth;
  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? chartWidth / 2 : xPosition(point.date);
      const y = chartHeight - ((point.value - axisMin) / axisRange) * (chartHeight - 12) - 6;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const [year, month] = referenceDate.slice(0, 7).split('-').map(Number);
  const xTicks = [
    startDate,
    `${year}-${String(month).padStart(2, '0')}-15`,
    referenceDate,
    `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-15`,
    endDate,
  ];

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400">Preço da cota</p>
      <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
        {money(october.value)}/cota
      </p>
      <p
        className={`mt-1 text-xs ${variation < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}
      >
        {monthLabel(september.date)}: {money(september.value)} · {variation >= 0 ? '+' : ''}
        {variation.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% até{' '}
        {monthLabel(october.date)}
      </p>
      <div
        className="mt-5"
        aria-label={`Variação do preço da cota entre ${monthLabel(september.date)} e ${monthLabel(october.date)}`}
      >
        <div className="flex gap-2">
          <div className="flex h-28 w-12 flex-col justify-between text-[10px] text-gray-500 dark:text-gray-400">
            <span>{money(axisMax)}</span>
            <span>{money(mid)}</span>
            <span>{money(axisMin)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="h-28 w-full overflow-visible"
              role="img"
            >
              <path
                d={`M 0 6 H ${chartWidth}`}
                fill="none"
                stroke="#94a3b8"
                strokeOpacity="0.42"
                strokeDasharray="3 4"
              />
              <path
                d={`M 0 ${chartHeight / 2} H ${chartWidth}`}
                fill="none"
                stroke="#94a3b8"
                strokeOpacity="0.42"
                strokeDasharray="3 4"
              />
              <path
                d={`M 0 ${chartHeight - 6} H ${chartWidth}`}
                fill="none"
                stroke="#94a3b8"
                strokeOpacity="0.42"
                strokeDasharray="3 4"
              />
              <line
                x1="0"
                y1={chartHeight - 6}
                x2={chartWidth}
                y2={chartHeight - 6}
                stroke="#94a3b8"
                strokeOpacity="0.65"
              />
              {xTicks.map((tick) => {
                const x = xPosition(tick);
                return (
                  <line
                    key={`tick-${tick}`}
                    x1={x}
                    y1={chartHeight - 6}
                    x2={x}
                    y2={chartHeight + 1}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                  />
                );
              })}
              <path
                d={path}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="0"
                cy={
                  chartHeight - ((september.value - axisMin) / axisRange) * (chartHeight - 12) - 6
                }
                r="3"
                fill="#94a3b8"
              />
              <circle
                cx={chartWidth}
                cy={chartHeight - ((october.value - axisMin) / axisRange) * (chartHeight - 12) - 6}
                r="3"
                fill="#3b82f6"
              />
            </svg>
            <div className="relative h-5 text-xs font-medium text-gray-600 dark:text-gray-300">
              {xTicks.map((tick, index) => (
                <span
                  key={tick}
                  className="absolute whitespace-nowrap"
                  style={{
                    left: `${(xPosition(tick) / chartWidth) * 100}%`,
                    transform:
                      index === 0
                        ? 'translateX(0)'
                        : index === xTicks.length - 1
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                  }}
                >
                  {dayMonthLabel(tick)}
                </span>
              ))}
            </div>
            <p className="mt-1 text-center text-[10px] text-gray-500 dark:text-gray-400">Período</p>
          </div>
        </div>
        <p className="mt-1 text-center text-[10px] text-gray-500 dark:text-gray-400">Preço (R$)</p>
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Fechamentos diários da B3.</p>
    </div>
  );
}


// Histórico manual, conferido em relatórios gerenciais oficiais do TGAR11.
// Não usar cotações de mercado como substituto de resultado de caixa.
// Cada ponto tem competência mensal; o último resultado de caixa é set/26.
const TGAR_HISTORY = [
  { month: 'out/25', cash: 1.07, distribution: 1.00 },
  { month: 'nov/25', cash: 0.97, distribution: 1.00 },
  { month: 'dez/25', cash: 1.00, distribution: 1.00 },
  { month: 'jan/26', cash: 0.62, distribution: 0.71 },
  { month: 'fev/26', cash: 0.79, distribution: 0.72 },
  { month: 'mar/26', cash: 0.63, distribution: 0.72 },
  { month: 'abr/26', cash: 0.76, distribution: 0.72 },
  { month: 'mai/26', cash: 0.75, distribution: 0.72 },
  { month: 'jun/26', cash: 0.67, distribution: 0.72 },
  { month: 'jul/26', cash: 0.79, distribution: 0.72 },
  { month: 'ago/26', cash: 0.59, distribution: 0.70 },
  { month: 'set/26', cash: 1.84, distribution: 0.70 },
  { month: 'out/26', cash: null, distribution: 0.46 },
];

const TGAR_SOURCES = [
  { label: 'Out/25 · p. 12', url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1059871#page=12' },
  { label: 'Nov–dez/25 · p. 17', url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1093428#page=17' },
  { label: 'Jan–mar/26 · p. 14', url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1173456#page=14' },
  { label: 'Abr–set/26 · p. 20', url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1365779#page=20' },
  { label: 'Rendimento out/26', url: 'https://tgar11.com.br/relatorio/rendimentos/' },
];

function TgarHistoryChart() {
  const left = 55;
  const right = 918;
  const top = 20;
  const bottom = 236;
  const axisMax = 2;
  const x = (index) => left + (index / (TGAR_HISTORY.length - 1)) * (right - left);
  const y = (value) => bottom - (value / axisMax) * (bottom - top);
  const path = (key) => TGAR_HISTORY.reduce((parts, item, index) => {
    const value = item[key];
    if (value === null) return parts;
    const previousExists = index > 0 && TGAR_HISTORY[index - 1][key] !== null;
    parts.push(`${previousExists ? 'L' : 'M'} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`);
    return parts;
  }, []).join(' ');

  const first = TGAR_HISTORY[0].distribution;
  const latest = TGAR_HISTORY[TGAR_HISTORY.length - 1].distribution;
  const variation = ((latest / first - 1) * 100);
  const attention = variation <= -30; // Limite visual local, não oficial.

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Evolução mensal de caixa e rendimentos
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Out/2025 a out/2026 · R$/cota · dados históricos dos relatórios oficiais
          </p>
        </div>
        <span className="rounded-full border border-gray-300 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300">
          13 competências
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={`rounded-lg border p-3 ${attention
          ? 'border-rose-500/50 bg-rose-500/10'
          : 'border-gray-200 dark:border-gray-700'}`}>
          <p className={`text-xs font-semibold ${attention ? 'text-rose-600 dark:text-rose-300' : 'text-gray-600 dark:text-gray-300'}`}>
            {attention ? 'Cuidado · redução do rendimento distribuído' : 'Rendimento distribuído'}
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
            {money(first)} → {money(latest)}/cota
            <span className={`ml-2 text-base ${attention ? 'text-rose-600 dark:text-rose-300' : 'text-gray-500'}`}>
              {variation.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Out/25 → out/26 · variação nominal, sem ajuste pela inflação</p>
        </div>
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Evento não recorrente no resultado de caixa</p>
          <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">Set/26: {money(1.84)}/cota</p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            Inclui alienações de empreendimentos; R$ 38,84 mi reconhecidos em setembro.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
        <span><span className="mr-1 inline-block h-0.5 w-4 align-middle bg-blue-500" />Resultado de caixa</span>
        <span><span className="mr-1 inline-block h-0.5 w-4 align-middle bg-rose-500" />Distribuição</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Venda de ativos (set/26)</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox="0 0 950 280" className="min-w-[650px] w-full" role="img"
          aria-label="Histórico mensal: linha azul para resultado de caixa e vermelha para rendimentos, de outubro de 2025 a outubro de 2026">
          {[0, 0.5, 1, 1.5, 2].map((tick) => (
            <g key={tick}>
              <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 4" />
              <text x={left - 9} y={y(tick) + 4} fill="currentColor" opacity="0.65" fontSize="12" textAnchor="end">
                {tick.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </text>
            </g>
          ))}
          <rect x={x(11) - 20} y={top} width="40" height={bottom - top} rx="5" fill="#f59e0b" fillOpacity="0.08" />
          <path d={path('cash')} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          <path d={path('distribution')} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {TGAR_HISTORY.map((item, index) => (
            <g key={item.month}>
              {item.cash !== null && (
                <circle cx={x(index)} cy={y(item.cash)} r={index === 11 ? 5.5 : 3} fill={index === 11 ? '#f59e0b' : '#3b82f6'}>
                  <title>{item.month}: resultado de caixa {money(item.cash)}/cota</title>
                </circle>
              )}
              <circle cx={x(index)} cy={y(item.distribution)} r={index === 12 ? 5.5 : 3} fill="#f43f5e">
                <title>{item.month}: distribuição {money(item.distribution)}/cota</title>
              </circle>
              {(index % 2 === 0 || index === TGAR_HISTORY.length - 1) && (
                <text x={x(index)} y={bottom + 22} fill="currentColor" opacity="0.65" fontSize="12" textAnchor="middle">
                  {item.month}
                </text>
              )}
            </g>
          ))}
          <text x={x(11)} y={y(1.84) - 12} fill="#f59e0b" fontWeight="600" fontSize="13" textAnchor="middle">1,84*</text>
          <text x={x(12)} y={y(0.46) + 22} fill="#f43f5e" fontWeight="600" fontSize="13" textAnchor="middle">0,46</text>
        </svg>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        *Set/26 inclui operações de venda. Resultado de caixa não equivale a renda recorrente.
        Out/26 ainda não possui resultado de caixa neste conjunto de relatórios; a linha azul termina em set/26.
        Sinal vermelho: redução de distribuição ≥30% (limite visual configurado, não oficial).
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-blue-600 dark:text-blue-400">
        {TGAR_SOURCES.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            Fonte: {source.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

export default function FiiHealthPanel({ ticker, purchaseDate, purchasePrice }) {
  const [mode, setMode] = useState('current');
  const asOf = mode === 'purchase' && purchaseDate ? purchaseDate : today();
  const current = useQuery({
    queryKey: ['asset-health', ticker, asOf],
    queryFn: () => fetchAssetHealth(ticker, asOf),
    enabled: Boolean(ticker),
  });
  const data = current.data?.status === 'available' ? current.data : null;
  const priorDate = beforePublication(data?.published_at);
  const earlier = useQuery({
    queryKey: ['asset-health', ticker, priorDate],
    queryFn: () => fetchAssetHealth(ticker, priorDate),
    enabled: Boolean(ticker && priorDate),
  });
  const prior = earlier.data?.status === 'available' ? earlier.data : null;
  const baseline = data?.metrics?.find((m) => m.key === 'distribution_per_share_brl');
  const minGuidance = data?.metrics?.find((m) => m.key === 'guidance_min_brl');
  const maxGuidance = data?.metrics?.find((m) => m.key === 'guidance_max_brl');
  const metrics = (data?.metrics || []).filter(
    (m) => !['guidance_min_brl', 'guidance_max_brl'].includes(m.key)
  );

  return (
    <section className="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <ShieldCheck className="h-6 w-6 text-blue-500" /> Saúde do FII
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Dados objetivos de relatórios oficiais.
          </p>
        </div>
        {purchaseDate && (
          <div className="flex gap-1 rounded-lg border border-gray-300 p-1 text-xs dark:border-gray-700">
            <button
              type="button"
              onClick={() => setMode('current')}
              aria-pressed={mode === 'current'}
              className={`rounded px-3 py-2 ${mode === 'current' ? 'bg-blue-600 text-white' : 'dark:text-gray-300'}`}
            >
              Atual
            </button>
            <button
              type="button"
              onClick={() => setMode('purchase')}
              aria-pressed={mode === 'purchase'}
              className={`rounded px-3 py-2 ${mode === 'purchase' ? 'bg-blue-600 text-white' : 'dark:text-gray-300'}`}
            >
              Na compra
            </button>
          </div>
        )}
      </div>
      {current.isPending && (
        <p role="status" className="text-sm text-gray-500">
          Consultando relatórios...
        </p>
      )}
      {current.error && (
        <p role="alert" className="text-sm text-red-600">
          {current.error.message}
        </p>
      )}
      {current.data?.status === 'unavailable' && (
        <p className="text-sm text-gray-500">Sem dados verificados cadastrados para essa data.</p>
      )}
      {data && (
        <>
          <div className="rounded-lg border border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <strong>
              {data.ticker} — {data.asset_name}
            </strong>{' '}
            · Competência {dateLabel(data.reference_date)} · Publicado em{' '}
            {dateLabel(data.published_at)} · Consulta até {dateLabel(asOf)}
            {data.is_stale && (
              <p className="mt-1 text-amber-600">
                Documento cadastrado há {data.days_since_publication} dias na data consultada.
              </p>
            )}
            {prior && (
              <p className="mt-1">
                Comparação com a última competência anterior cadastrada:{' '}
                {dateLabel(prior.reference_date)}.
              </p>
            )}
          </div>
          {ticker?.toUpperCase() === 'TGAR11' && mode === 'current' && <TgarHistoryChart />}
          {ticker?.toUpperCase() === 'TGAR11' && mode === 'purchase' && (
            <TgarPurchasePanel asOf={asOf} purchasePrice={purchasePrice} />
          )}
          {!(ticker?.toUpperCase() === 'TGAR11' && mode === 'purchase') && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map((metric) => {
                  const old =
                    metric.key === 'announced_distribution_per_share_brl'
                      ? baseline
                      : prior?.metrics?.find((m) => m.key === metric.key);
                  const diff =
                    old && Number(old.value) !== 0
                      ? (Number(metric.value) / Number(old.value) - 1) * 100
                      : null;
                  const vacancy = ['physical_vacancy_pct', 'financial_vacancy_pct'].includes(
                    metric.key
                  );
                  const highVacancy = vacancy && Number(metric.value) >= 40;
                  const mediumVacancy = vacancy && Number(metric.value) >= 20;
                  const negative =
                    ['monthly_result_brl', 'result_12m_brl'].includes(metric.key) &&
                    Number(metric.value) < 0;
                  const badColor = highVacancy || negative;
                  const border = badColor
                    ? 'border-rose-400 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20'
                    : mediumVacancy
                      ? 'border-amber-400 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20'
                      : 'border-gray-200 dark:border-gray-700';
                  const fallingDistribution =
                    ['distribution_per_share_brl', 'announced_distribution_per_share_brl'].includes(
                      metric.key
                    ) && diff < 0;
                  return (
                    <div key={metric.key} className={`rounded-xl border p-4 ${border}`}>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{metric.label}</p>
                      <p
                        className={`mt-2 text-xl font-bold ${badColor ? 'text-rose-700 dark:text-rose-300' : 'text-gray-900 dark:text-white'}`}
                      >
                        {display(metric)}
                      </p>
                      {old && metric.unit !== 'brl_per_share' && (
                        <p
                          className={`mt-2 text-xs ${fallingDistribution ? 'text-rose-600 dark:text-rose-300' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                          Anterior: {display(old)} (
                          {dateLabel(
                            metric.key === 'announced_distribution_per_share_brl'
                              ? data.reference_date
                              : prior?.reference_date
                          )}
                          )
                          {diff !== null &&
                            ` · ${diff > 0 ? '+' : ''}${diff.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                        </p>
                      )}
                      {metric.unit === 'brl_per_share' && old && !(ticker?.toUpperCase() === 'TGAR11' && mode === 'current') && (
                        <ShareValueBars
                          current={metric}
                          previous={old}
                          currentDate={
                            metric.key === 'announced_distribution_per_share_brl'
                              ? nextMonthEnd(data.reference_date)
                              : data.reference_date
                          }
                          previousDate={
                            metric.key === 'announced_distribution_per_share_brl'
                              ? data.reference_date
                              : prior?.reference_date
                          }
                        />
                      )}
                      {metric.note &&
                        !['cash_result_per_share_brl', 'announced_distribution_per_share_brl'].includes(
                          metric.key
                        ) && (
                          <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{metric.note}</p>
                        )}
                      <a
                        href={`${data.source.url}#page=${metric.page}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Fonte · pág. {metric.page} <ArrowUpRight size={12} />
                      </a>
                    </div>
                  );
                })}
                {minGuidance && maxGuidance && (
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <p className="text-xs text-gray-500">Projeção mensal (não garantida)</p>
                    <p className="mt-2 text-xl font-bold dark:text-white">
                      {money(minGuidance.value)} a {money(maxGuidance.value)}/cota
                    </p>
                    <GuidanceRangeChart
                      minimum={minGuidance.value}
                      maximum={maxGuidance.value}
                      announced={
                        data?.metrics?.find((m) => m.key === 'announced_distribution_per_share_brl')
                          ?.value
                      }
                    />
                    <a
                      href={`${data.source.url}#page=${minGuidance.page}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-xs text-blue-600"
                    >
                      Fonte · pág. {minGuidance.page}
                    </a>
                  </div>
                )}
                <SharePriceCard ticker={data.ticker} referenceDate={data.reference_date} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cores: vacância ≥40% vermelha, ≥20% amarela; resultados negativos vermelhos. Limites
                visuais configuráveis, não oficiais. Nenhuma nota ou recomendação de investimento.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
