import { ArrowUpRight, ShieldCheck } from 'lucide-react';

const money = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatValue = (value, unit) => {
  if (unit === 'percent') return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  if (unit === 'brl_per_share') return `${money(value)}/cota`;
  return money(value);
};
const formatAxis = (value, unit) => {
  if (unit === 'percent') return `${Math.round(value)}%`;
  if (unit === 'brl_per_share') return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const abs = Math.abs(value);
  return abs >= 1e6 ? `${(value / 1e6).toFixed(1).replace('.', ',')}mi`
    : abs >= 1e3 ? `${Math.round(value / 1e3)}mil` : `${Math.round(value)}`;
};
const displayMonth = (value) => {
  const [y, m] = value.split('-');
  return `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(m) - 1]}/${y.slice(-2)}`;
};
const monthNumber = (month) => {
  const [year, mm] = month.split('-').map(Number);
  return year * 12 + mm - 1;
};
const monthFromNumber = (number) => `${Math.floor(number / 12)}-${String(number % 12 + 1).padStart(2, '0')}`;
const shortDate = (value) => value ? value.slice(0, 10).split('-').reverse().join('/') : null;

function TimelineChart({ chart, months, contributions }) {
  const width = 560, height = 208, left = 53, right = 538, top = 24, bottom = 169;
  const byMonth = new Map(chart.data.map((point) => [point.month, point]));
  const rows = months.map((month) => byMonth.get(month) || { month, value: null });
  const valid = rows.filter((row) => row.value !== null && Number.isFinite(Number(row.value)));
  const values = valid.map((row) => Number(row.value));
  if (chart.reference !== null && chart.reference !== undefined) values.push(chart.reference);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const difference = maximum - minimum;
  const range = difference || 1;
  // Vacância fica em 0..100, mas outras proporções podem ultrapassar 100%.
  const padding = Math.max(range * 0.08, difference === 0 ? Math.abs(minimum) * 0.1 : 0,
    chart.unit === 'brl_per_share' ? 0.02 : 1);
  const yMin = valid.length ? (minimum < 0 ? minimum - padding : Math.max(0, minimum - padding)) : 0;
  const yMax = valid.length ? maximum + padding : 1;
  const x = (index) => left + (index / Math.max(1, months.length - 1)) * (right - left);
  const y = (value) => bottom - (value - yMin) / Math.max(0.00001, yMax - yMin) * (bottom - top);

  const segments = [];
  let segment = [];
  rows.forEach((row, index) => {
    if (row.value !== null && Number.isFinite(Number(row.value))) {
      segment.push(`${x(index).toFixed(2)},${y(Number(row.value)).toFixed(2)}`);
    } else if (segment.length) {
      segments.push(segment);
      segment = [];
    }
  });
  if (segment.length) segments.push(segment);

  const markers = contributions.flatMap((item, i) => {
    const date = String(item.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const [year, month, day] = date.split('-').map(Number);
    const index = months.indexOf(`${year}-${String(month).padStart(2, '0')}`);
    if (index < 0) return [];
    const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const previous = contributions.slice(0, i).filter((other) => String(other.date || '').slice(0, 10) === date).length;
    const position = index === 0 ? x(0) : x(index - 1 + day / totalDays);
    return [{ date, position: position + previous * 2.5, index: i, item }];
  });

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[420px]" role="img"
        aria-label={`${chart.title}: série histórica com datas de aporte` }>
        {[yMin, (yMin + yMax) / 2, yMax].map((tick) => (
          <g key={tick}>
            <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 4" />
            <text x={left - 6} y={y(tick) + 4} fill="currentColor" opacity="0.65"
              fontSize="10.5" textAnchor="end">{formatAxis(tick, chart.unit)}</text>
          </g>
        ))}
        {chart.reference !== undefined && chart.reference !== null && (
          <line x1={left} x2={right} y1={y(chart.reference)} y2={y(chart.reference)}
            stroke="#94a3b8" strokeOpacity="0.7" strokeDasharray="2 4" />
        )}
        {segments.map((points, index) => points.length > 1 && (
          <polyline key={index} points={points.join(' ')} fill="none" stroke={chart.color || '#3b82f6'}
            strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {rows.map((row, index) => row.value !== null && Number.isFinite(Number(row.value)) && (
          <circle key={row.month} cx={x(index)} cy={y(Number(row.value))} r="3" fill={chart.color || '#3b82f6'}>
            <title>{`${displayMonth(row.month)}: ${formatValue(row.value, chart.unit)}.${row.publishedAt ? ` Publicado em ${shortDate(row.publishedAt)}.` : ''}${row.note ? ` ${row.note}` : ''}`}</title>
          </circle>
        ))}
        {markers.map((mark, index) => (
          <g key={`${mark.date}-${index}`}>
            <line x1={mark.position} x2={mark.position} y1={top} y2={bottom}
              stroke="#93c5fd" strokeDasharray="3 4" strokeWidth="1.3" />
            <circle cx={mark.position} cy={top} r="3" fill="#93c5fd" />
            <text x={mark.position + 4} y={top - 7 - index % 2 * 9} fontSize="10"
              fill="currentColor" opacity="0.9">{shortDate(mark.date)}</text>
            <title>{`Aporte em ${shortDate(mark.date)}${mark.item.price ? `, ${money(mark.item.price)}/cota` : ''}`}</title>
          </g>
        ))}
        {months.map((month, index) => (index % 4 === 0 || index === months.length - 1) && (
          <text key={month} x={x(index)} y={bottom + 21} fontSize="10.5" fill="currentColor"
            opacity="0.7" textAnchor="middle">{displayMonth(month)}</text>
        ))}
      </svg>
    </div>
  );
}


// Modo opcional: posiciona somente observações oficiais no dia da publicação do PDF.
// Falta de uma competência não cria ponto fictício; intervalos sem observações são tracejados.
function ReportDatesChart({ chart, contributions }) {
  const width = 560, height = 208, left = 53, right = 538, top = 24, bottom = 169;
  const actualDate = (row) => /^\d{4}-\d{2}-\d{2}$/.test(row.publishedAt || '')
    ? row.publishedAt : `${row.month}-15`;
  const timestamp = (date) => Date.parse(`${date}T00:00:00Z`);
  const rows = chart.data
    .filter((row) => row.value !== null && Number.isFinite(Number(row.value)))
    .sort((a, b) => actualDate(a).localeCompare(actualDate(b)) || a.month.localeCompare(b.month));
  const datesOfContributions = contributions
    .map((item) => String(item.date || '').slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
  const dates = [...rows.map(actualDate), ...datesOfContributions].map(timestamp);
  const start = Math.min(...dates), end = Math.max(...dates);
  const xDate = (date) => left + (timestamp(date) - start) / Math.max(1, end - start) * (right - left);
  // Duas competências podem ser divulgadas no mesmo PDF: ligeiro deslocamento visual.
  const x = (index) => xDate(actualDate(rows[index]))
    + (index > 0 && actualDate(rows[index - 1]) === actualDate(rows[index]) ? 3 : 0);

  const values = rows.map((row) => Number(row.value));
  if (chart.reference !== null && chart.reference !== undefined) values.push(chart.reference);
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.08, chart.unit === 'brl_per_share' ? 0.02 : 1);
  const yMin = minimum < 0 ? minimum - padding : Math.max(0, minimum - padding);
  const yMax = maximum + padding;
  const y = (value) => bottom - (value - yMin) / Math.max(0.00001, yMax - yMin) * (bottom - top);
  const ticks = [];
  rows.forEach((row, index) => {
    const position = x(index), last = index === rows.length - 1;
    if (last && ticks.length && position - ticks.at(-1).position < 78) ticks.pop();
    if (last || !ticks.length || position - ticks.at(-1).position >= 78) {
      ticks.push({ key: `${row.month}-${index}`, position,
        label: row.publishedAt ? shortDate(row.publishedAt) : displayMonth(row.month) });
    }
  });
  const markers = datesOfContributions.map((date, index) => ({
    date,
    x: xDate(date) + datesOfContributions.slice(0, index).filter((other) => other === date).length * 2.5,
    item: contributions.filter((item) => String(item.date || '').slice(0, 10) === date)[0],
  }));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[420px]" role="img"
        aria-label={`${chart.title}: valores na data de publicação dos relatórios, com marcações de aporte`}>
        {[yMin, (yMin + yMax) / 2, yMax].map((tick) => (
          <g key={tick}>
            <line x1={left} x2={right} y1={y(tick)} y2={y(tick)}
              stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 4" />
            <text x={left - 6} y={y(tick) + 4} fill="currentColor" opacity="0.65"
              fontSize="10.5" textAnchor="end">{formatAxis(tick, chart.unit)}</text>
          </g>
        ))}
        {chart.reference !== null && chart.reference !== undefined && (
          <line x1={left} x2={right} y1={y(chart.reference)} y2={y(chart.reference)}
            stroke="#94a3b8" strokeOpacity="0.7" strokeDasharray="2 4" />
        )}
        {rows.slice(1).map((row, index) => (
          <line key={`${rows[index].month}-${row.month}`}
            x1={x(index)} y1={y(Number(rows[index].value))}
            x2={x(index + 1)} y2={y(Number(row.value))}
            stroke={chart.color || '#3b82f6'} strokeWidth="2.7" strokeLinecap="round"
            strokeDasharray={Math.abs(monthNumber(row.month) - monthNumber(rows[index].month)) > 1
              ? '5 4' : undefined} />
        ))}
        {rows.map((row, index) => (
          <circle key={row.month} cx={x(index)} cy={y(Number(row.value))} r="3"
            fill={chart.color || '#3b82f6'}>
            <title>{`${displayMonth(row.month)}: ${formatValue(row.value, chart.unit)}.${row.publishedAt
              ? ` Publicado em ${shortDate(row.publishedAt)}.` : ' Data de publicação não cadastrada.'}${row.note ? ` ${row.note}` : ''}`}</title>
          </circle>
        ))}
        {markers.map((mark, index) => (
          <g key={`${mark.date}-${index}`}>
            <line x1={mark.x} x2={mark.x} y1={top} y2={bottom}
              stroke="#93c5fd" strokeDasharray="3 4" strokeWidth="1.3" />
            <circle cx={mark.x} cy={top} r="3" fill="#93c5fd" />
            <text x={mark.x + 4} y={top - 7 - index % 2 * 9} fontSize="10"
              fill="currentColor" opacity="0.9">{shortDate(mark.date)}</text>
          </g>
        ))}
        {ticks.map((tick) => (
          <text key={tick.key} x={tick.position} y={bottom + 21}
            fill="currentColor" fontSize="10.5" opacity="0.7" textAnchor="middle">{tick.label}</text>
        ))}
      </svg>
    </div>
  );
}

function MetricChart({ chart, months, contributions }) {
  const valid = chart.data.filter((row) => row.value !== null && Number.isFinite(Number(row.value)));
  const last = [...valid].sort((a, b) => a.month.localeCompare(b.month)).at(-1);
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{chart.title}</p>
        {last && <span className="text-sm font-semibold tabular-nums" style={{ color: chart.color || '#3b82f6' }}>
          {formatValue(last.value, chart.unit)}
        </span>}
      </div>
      {valid.length ? (chart.xAxis === 'report_dates'
        ? <ReportDatesChart chart={chart} contributions={contributions} />
        : <TimelineChart chart={chart} months={months} contributions={contributions} />) : (
        <div className="flex h-44 items-center justify-center text-xs text-gray-500 dark:text-gray-400">
          Série histórica ainda não cadastrada
        </div>
      )}
      {chart.note && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{chart.note}</p>}
      {chart.xAxis === 'report_dates' && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Eixo X: publicação dos PDFs (sem data cadastrada: competência). Linha tracejada =
        intervalo sem competências confirmadas; nenhum valor intermediário foi inventado.
      </p>}
      {last?.source && <a href={`${last.source}${last.page ? `#page=${last.page}` : ''}`}
        target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-blue-500 hover:underline">
        Fonte de {displayMonth(last.month)} <ArrowUpRight size={12} />
      </a>}
      {valid.length > 0 && valid.length < 3 && <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
        Série parcial: {valid.length} competência(s) confirmada(s). Lacunas não foram interpoladas.
      </p>}
    </div>
  );
}

export default function FiiHistoricalPanel({ report, contributions = [], purchasePrice }) {
  const dates = contributions
    .map((item) => String(item.date || '').slice(0, 7))
    .filter((value) => /^\d{4}-\d{2}$/.test(value));
  const lastMonth = [report.endMonth, ...dates].sort().at(-1);
  const months = Array.from({ length: monthNumber(lastMonth) - monthNumber(report.startMonth) + 1 },
    (_, index) => monthFromNumber(monthNumber(report.startMonth) + index));
  const price = Number(purchasePrice);
  const pvpFact = Number.isFinite(price) && price > 0 && report.pvpNav > 0 ? [{
    label: 'P/VP no primeiro aporte',
    value: `${(price / report.pvpNav).toFixed(2).replace('.', ',')}x`,
    detail: `${money(price)} ÷ VP disponível na compra de ${money(report.pvpNav)}.`,
  }] : [];
  const facts = [...(report.facts || []), ...pvpFact];

  return (
    <section className="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
          <ShieldCheck className="h-6 w-6 text-blue-500" /> Saúde do FII
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Dados históricos de relatórios oficiais, com marcações de cada aporte.</p>
      </div>
      <div className="rounded-lg border border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <strong>{report.ticker} — {report.name}</strong> · Histórico desde {displayMonth(report.startMonth)}
        <p className="mt-1">{report.summary}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {report.charts.map((chart) => (
          <MetricChart key={chart.id} chart={chart} months={months} contributions={contributions} />
        ))}
      </div>
      {facts.length > 0 && (
        <details className="rounded-lg border border-gray-200 dark:border-gray-700">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
            Ver indicadores complementares ({facts.length})
          </summary>
          <div className="grid grid-cols-1 gap-3 border-t border-gray-200 p-3 sm:grid-cols-2 xl:grid-cols-3 dark:border-gray-700">
            {facts.map((fact) => (
              <div key={fact.label} className={`rounded-lg border p-3 ${fact.severity === 'danger'
                ? 'border-rose-500/60 bg-rose-500/10'
                : fact.severity === 'warning' ? 'border-amber-500/60 bg-amber-500/10'
                  : 'border-gray-200 dark:border-gray-700'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{fact.label}</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{fact.value}</p>
                {fact.detail && <p className="text-xs text-gray-500 dark:text-gray-400">{fact.detail}</p>}
              </div>
            ))}
          </div>
        </details>
      )}
      {report.sources?.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-blue-600 dark:text-blue-400">
          {report.sources.map((source) => <a key={source.url} href={source.url} target="_blank"
            rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
            {source.label} <ArrowUpRight size={12} />
          </a>)}
        </div>
      )}
    </section>
  );
}
