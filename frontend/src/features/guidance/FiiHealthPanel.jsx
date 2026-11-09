import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { fetchFiiChartData } from '../../services/b3service.js';
import { fetchAssetHealth } from '../../services/walletDataService.js';
import TgarPurchasePanel from './TgarPurchasePanel.jsx';
import FiiHistoricalPanel from './FiiHistoricalPanel.jsx';
import { FII_HEALTH_REPORTS } from './fiiHealthReports.js';

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

function LegacyFiiHealthPanel({
  ticker,
  purchaseDate,
  purchasePrice,
  contributions = [],
}) {
  const asOf = purchaseDate;
  const current = useQuery({
    queryKey: ['asset-health', ticker, asOf],
    queryFn: () => fetchAssetHealth(ticker, asOf),
    enabled: Boolean(ticker && asOf),
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
          {ticker?.toUpperCase() === 'TGAR11' && (
            <TgarPurchasePanel
              asOf={asOf}
              purchasePrice={purchasePrice}
              contributions={contributions}
            />
          )}
          {ticker?.toUpperCase() !== 'TGAR11' && (
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
                      {metric.unit === 'brl_per_share' && old && (
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
                        ![
                          'cash_result_per_share_brl',
                          'announced_distribution_per_share_brl',
                        ].includes(metric.key) && (
                          <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                            {metric.note}
                          </p>
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

// Painel configurável: cada fundo define suas séries e indicadores.
// Fundos sem histórico cadastrado preservam a implementação anterior.
export default function FiiHealthPanel(props) {
  const ticker = String(props.ticker || '').toUpperCase();
  const report = FII_HEALTH_REPORTS[ticker];

  return report
    ? (
      <FiiHistoricalPanel
        report={report}
        contributions={props.contributions || []}
        purchasePrice={props.purchasePrice}
      />
    )
    : <LegacyFiiHealthPanel {...props} />;
}
