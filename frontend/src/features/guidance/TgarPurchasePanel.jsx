import { ArrowUpRight } from 'lucide-react';

const money = (value) => Number(value).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL',
});

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const monthLabelFromDate = (date) => {
  const [year, month] = date.slice(0, 7).split('-');
  return `${MONTHS[Number(month) - 1]}/${year.slice(-2)}`;
};

// Série histórica integral. Os sinais na compra usam somente os dados
// conhecidos até 29/12/2025; a série exibida continua depois do aporte.
// Dez/24–out/25: relatório de out/25 publicado em 12/12/25, tabela p. 9.
// Nov/25: informe mensal divulgado em 23/12/25 (FNET 1068335).
const NAV = [
  ['dez/24', 115.15], ['jan/25', 114.42], ['fev/25', 113.90],
  ['mar/25', 113.19], ['abr/25', 112.82], ['mai/25', 112.10],
  ['jun/25', 111.15], ['jul/25', 110.24], ['ago/25', 109.67],
  ['set/25', 108.84], ['out/25', 108.35], ['nov/25', 107.50],
  ['dez/25', 113.46], ['jan/26', 113.05], ['fev/26', 110.16],
  ['mar/26', 110.54], ['abr/26', 109.71], ['mai/26', 108.79],
  ['jun/26', 108.03], ['jul/26', 107.24], ['ago/26', 106.64],
  ['set/26', 107.80],
].map(([month, value]) => ({ month, value }));

// Rendimentos por mês de anúncio, conforme histórico oficial da gestora.
// Dez/25 foi anunciado em 30/12/2025, após a compra.
const DISTRIBUTIONS = [
  ['jan/24', 1.32], ['fev/24', 1.33], ['mar/24', 1.33],
  ['abr/24', 1.34], ['mai/24', 1.35], ['jun/24', 1.33],
  ['jul/24', 1.22], ['ago/24', 1.12], ['set/24', 1.14],
  ['out/24', 1.15], ['nov/24', 1.15], ['dez/24', 1.10],
  ['jan/25', 1.00], ['fev/25', 1.00], ['mar/25', 1.00],
  ['abr/25', 1.00], ['mai/25', 1.00], ['jun/25', 1.00],
  ['jul/25', 1.00], ['ago/25', 1.00], ['set/25', 1.00],
  ['out/25', 1.00], ['nov/25', 1.00], ['dez/25', 1.00],
  ['jan/26', 0.71], ['fev/26', 0.72], ['mar/26', 0.72],
  ['abr/26', 0.72], ['mai/26', 0.72], ['jun/26', 0.72],
  ['jul/26', 0.72], ['ago/26', 0.70], ['set/26', 0.70],
  ['out/26', 0.46],
].map(([month, value]) => ({ month, value }));


// Eixo X comum a TODOS os gráficos, inclusive os meses ainda sem informe.
const TGAR_TIMELINE = [
  'dez/24','jan/25','fev/25','mar/25','abr/25','mai/25',
  'jun/25','jul/25','ago/25','set/25','out/25','nov/25',
  'dez/25','jan/26','fev/26','mar/26','abr/26','mai/26',
  'jun/26','jul/26','ago/26','set/26','out/26',
];

// Relatórios mensais B3/CVM: linhas 9 (necessidades de liquidez)
// e 12 (rendimentos a distribuir). Valores em R$ milhões, arredondados.
// Fontes originais (https://fnet.bmfbovespa.com.br/fnet/publico/
// exibirDocumento?cvm=true&id=ID): 909350, 881553, 947793,
// 1015816, 1068335, 1096174, 1161646, 1249735 e 1352690.
const TGAR_LIQUIDITY = [
  ['dez/24',27.45,25.92], ['jan/25',30.2,23.6], ['fev/25',7.56,23.6],
  ['mar/25',38.39,23.6], ['abr/25',13.75,23.6], ['mai/25',22.52,23.6],
  ['jun/25',14.90,23.6], ['jul/25',14.0,23.6], ['ago/25',9.75,23.6],
  ['set/25',4.56,23.6], ['out/25',23.0,23.6], ['nov/25',9.07547032,23.56909323],
  ['dez/25',25.89,23.56909372], ['jan/26',2.45,16.7], ['fev/26',36.2,17.0],
  ['mar/26',43.57,16.97006672], ['abr/26',13.4,17.0], ['mai/26',5.84,17.0],
  ['jun/26',4.87334142,16.96894093], ['jul/26',8.24,17.0],
  ['ago/26',1.61,16.5], ['set/26',13.7,16.5],
].map(([month, cash, toPay]) => ({
  month, value: 100 * cash / toPay,
  note: `Liquidez: R$ ${cash.toFixed(2).replace('.', ',')} mi; a distribuir: R$ ${toPay.toFixed(2).replace('.', ',')} mi`,
}));

// Proxy DERIVADA, não série oficial de resultado ou cobertura de caixa.
// (VP do mês - VP dez/24 + soma dos proventos jan/25..mês) / soma dos proventos.
// Usa apenas valores divulgados, sem preencher competências inexistentes.
const TGAR_DISTRIBUTION_MAP = new Map(DISTRIBUTIONS.map(({ month, value }) => [month, value]));
let tgarDistributed = 0;
const TGAR_ECONOMIC_RATIO = NAV.slice(1).map(({ month, value }) => {
  const distributed = TGAR_DISTRIBUTION_MAP.get(month);
  if (distributed === undefined) return { month, value: null };
  tgarDistributed += distributed;
  return {
    month, value: 100 * (value - NAV[0].value + tgarDistributed) / tgarDistributed,
    note: 'Proxy acumulada desde jan/25: variação do VP + proventos / proventos',
  };
});

const NAV_AT_BUY = NAV.slice(
  0, NAV.findIndex((row) => row.month === 'nov/25') + 1
);
const DIVIDENDS_AT_BUY = DISTRIBUTIONS.slice(
  0, DISTRIBUTIONS.findIndex((row) => row.month === 'nov/25') + 1
);

function HistoryLine({
  data,
  stroke,
  accessibleLabel,
  unit = 'money',
  reference = null,
  contributions = [],
}) {
  const width = 560;
  const height = 208;
  const left = 48;
  const right = 540;
  const top = 22;
  const bottom = 169;

  const monthNames = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez',
  ];

  const purchases = contributions
    .filter((item) =>
      /^\d{4}-\d{2}-\d{2}/.test(String(item.date || ''))
    )
    .map((item) => ({
      ...item,
      date: String(item.date).slice(0, 10),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Mesmo eixo temporal para os quatro gráficos.
  const timeline = [...TGAR_TIMELINE];

  // Estende o eixo caso exista algum aporte mais recente.
  const lastPurchase = purchases[purchases.length - 1]?.date;

  if (lastPurchase) {
    const lastMonth = lastPurchase.slice(0, 7);
    let year = 2026;
    let month = 10;

    while (
      `${year}-${String(month).padStart(2, '0')}` < lastMonth &&
      timeline.length < 100
    ) {
      month += 1;

      if (month > 12) {
        month = 1;
        year += 1;
      }

      timeline.push(
        `${monthNames[month - 1]}/${String(year).slice(-2)}`
      );
    }
  }

  const byMonth = new Map(
    data.map((row) => [row.month, row])
  );

  const rows = timeline.map(
    (month) => byMonth.get(month) || { month, value: null }
  );

  const valid = rows.filter(
    (row) => Number.isFinite(row.value)
  );

  if (!valid.length) return null;

  const values = valid.map((row) => row.value);

  if (reference !== null) {
    values.push(reference);
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  const margin = Math.max(
    (rawMax - rawMin) * 0.12,
    unit === 'percent' ? 3 : 0.03
  );

  const min = rawMin - margin;
  const max = rawMax + margin;

  const x = (index) =>
    left + (index / (timeline.length - 1)) * (right - left);

  const y = (value) =>
    bottom -
    ((value - min) / (max - min)) * (bottom - top);

  const format = (value) =>
    unit === 'percent'
      ? `${value.toFixed(0).replace('.', ',')}%`
      : value.toFixed(2).replace('.', ',');

  // Linha única: não divide antes/depois do aporte.
  const segments = [];
  let current = [];

  rows.forEach((row, i) => {
    if (Number.isFinite(row.value)) {
      current.push(`${x(i)},${y(row.value)}`);
    } else if (current.length) {
      segments.push(current.join(' '));
      current = [];
    }
  });

  if (current.length) {
    segments.push(current.join(' '));
  }

  // Cada aporte recebe sua própria posição no eixo temporal.
  const marks = purchases.map((item, i) => {
    const [year, month, day] = item.date
      .split('-')
      .map(Number);

    const label =
      `${monthNames[month - 1]}/${String(year).slice(-2)}`;

    const monthIndex = timeline.indexOf(label);

    if (monthIndex < 0) return null;

    const days = new Date(
      Date.UTC(year, month, 0)
    ).getUTCDate();

    // Evita sobreposição completa de aportes feitos no mesmo dia.
    const overlap = purchases
      .slice(0, i)
      .filter((previous) => previous.date === item.date)
      .length;

    const position = (
      monthIndex === 0
        ? x(0)
        : x(monthIndex - 1 + day / days)
    ) + overlap * 2.5;

    return {
      ...item,
      position,
      label: item.date.split('-').reverse().join('/'),
    };
  }).filter(Boolean);

  return (
    <div
      className="overflow-x-auto"
      data-tgar-all-contributions="true"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[420px] w-full"
        role="img"
        aria-label={accessibleLabel}
      >
        {/* Eixo Y */}
        {[min, (min + max) / 2, max].map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeDasharray="4 4"
            />
            <text
              x={left - 6}
              y={y(tick) + 4}
              fontSize="11"
              opacity="0.65"
              fill="currentColor"
              textAnchor="end"
            >
              {format(tick)}
            </text>
          </g>
        ))}

        {/* Linha de referência, quando aplicável */}
        {reference !== null && (
          <line
            x1={left}
            x2={right}
            y1={y(reference)}
            y2={y(reference)}
            stroke="#94a3b8"
            strokeDasharray="2 4"
            strokeOpacity="0.65"
          />
        )}

        {/* Série histórica contínua */}
        {segments.map((points, i) => (
          <polyline
            key={i}
            points={points}
            fill="none"
            stroke={stroke}
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Pontos da série */}
        {rows.map((row, i) =>
          Number.isFinite(row.value) && (
            <circle
              key={row.month}
              cx={x(i)}
              cy={y(row.value)}
              r={
                row === valid[valid.length - 1]
                  ? 4
                  : 2.3
              }
              fill={stroke}
            >
              <title>
                {row.month}: {format(row.value)}
                {unit === 'percent' ? '' : ' R$/cota'}
                {row.note || ''}
              </title>
            </circle>
          )
        )}

        {/* Uma marcação vertical por aporte */}
        {marks.map((mark, i) => (
          <g key={`${mark.date}-${i}`}>
            <line
              x1={mark.position}
              x2={mark.position}
              y1={top}
              y2={bottom}
              stroke="#94a3b8"
              strokeDasharray="3 4"
              strokeWidth="1.4"
            />

            <circle
              cx={mark.position}
              cy={top}
              r="3"
              fill="#93c5fd"
            />

            <text
              x={mark.position + 4}
              y={top - 7 - (i % 2) * 9}
              fontSize="10"
              fill="currentColor"
              opacity="0.85"
            >
              {mark.label.slice(0, 6) + mark.label.slice(-2)}
            </text>

            <title>
              Aporte em {mark.label}:
              {' '}{mark.qty || '?'} cota(s)
              {mark.price
                ? `, ${money(mark.price)}/cota`
                : ''}
            </title>
          </g>
        ))}

        {/* Eixo X compartilhado */}
        {timeline.map((month, i) =>
          (i % 4 === 0 || i === timeline.length - 1) && (
            <text
              key={month}
              x={x(i)}
              y={bottom + 21}
              fontSize="10.5"
              opacity="0.65"
              fill="currentColor"
              textAnchor="middle"
            >
              {month}
            </text>
          )
        )}
      </svg>
    </div>
  );
}

function Fact({ label, value, detail, color = 'normal' }) {
  const styles = {
    normal: 'border-gray-200 dark:border-gray-700',
    red: 'border-rose-400/60 bg-rose-500/10',
    amber: 'border-amber-400/60 bg-amber-500/10',
  };
  return (
    <div className={`rounded-lg border p-3 ${styles[color]}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${color === 'red' ? 'text-rose-600 dark:text-rose-300' : 'text-gray-900 dark:text-white'}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{detail}</p>
    </div>
  );
}

const SOURCES = [
  { label: 'Gerencial out/25 · p. 12', url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1059871#page=12' },
  { label: 'Informe nov/25 · publicado 23/12', url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1068335' },
  { label: 'Rendimentos até out/26', url: 'https://tgar11.com.br/relatorio/rendimentos/' },
  { label: 'Informe mensal set/26 · B3', url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1352690' },
  { label: 'Todos os informes mensais', url: 'https://brfiis.com.br/fundos/TGAR11/documentos?tipo=informes-periodicos' },
];

export default function TgarPurchasePanel({ asOf, purchasePrice, contributions = [] }) {
  // Evita usar documentos de 23/12/25 para simular uma compra anterior.
  if (!asOf || asOf.slice(0, 10) < '2025-12-23') return null;

  const startNav = NAV_AT_BUY[0].value;
  const endNav = NAV_AT_BUY[NAV_AT_BUY.length - 1].value;
  const navChange = (endNav / startNav - 1) * 100;
  const consecutiveDrops = NAV_AT_BUY.slice(1).filter((row, index) => row.value < NAV_AT_BUY[index].value).length;
  const dividendPeak = 1.35;
  const dividendLast = DIVIDENDS_AT_BUY[DIVIDENDS_AT_BUY.length - 1].value;
  const dividendChange = (dividendLast / dividendPeak - 1) * 100;
  const price = Number(purchasePrice);
  const hasPrice = purchasePrice !== null && purchasePrice !== undefined && Number.isFinite(price) && price > 0;
  const pvp = hasPrice ? price / endNav : null;
  const contributionDate = asOf.slice(0, 10).split('-').reverse().join('/');
  const contributionMonth = monthLabelFromDate(asOf);

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Evolução histórica do TGAR11
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          As datas dos aportes registrados aparecem nos quatro gráficos. Patrimônio e liquidez até set/26; rendimentos até out/26.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Valor patrimonial por cota</p>
            <span className="text-sm font-semibold text-rose-600 dark:text-rose-300">{navChange.toFixed(1).replace('.', ',')}%</span>
          </div>
          <HistoryLine contributions={contributions} data={NAV} stroke="#f43f5e" contributionDate={contributionDate} contributionMonth={contributionMonth} accessibleLabel="Valor patrimonial por cota de dezembro de 2024 a setembro de 2026, com indicador do aporte" />
        </div>
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Rendimentos anunciados por cota</p>
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-300">{dividendChange.toFixed(1).replace('.', ',')}%*</span>
          </div>
          <HistoryLine contributions={contributions} data={DISTRIBUTIONS} stroke="#f59e0b" contributionDate={contributionDate} contributionMonth={contributionMonth} accessibleLabel="Rendimentos mensais anunciados de janeiro de 2024 a outubro de 2026, com indicador do aporte" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2" data-tgar-prioritarios="true">
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Ganho patrimonial acumulado ÷ proventos
          </p>
          <HistoryLine contributions={contributions} data={TGAR_ECONOMIC_RATIO} unit="percent" reference={100}
            stroke="#f43f5e" accessibleLabel="Ganho patrimonial aproximado, acumulado desde janeiro de 2025, por mês no eixo de dezembro de 2024 a outubro de 2026" />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Estimativa = (variação do VP desde dez/24 + proventos) ÷ proventos desde jan/25.
            Linha 100%: VP preservado. Não é geração nem cobertura de caixa.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Liquidez imediata ÷ rendimentos a distribuir
          </p>
          <HistoryLine contributions={contributions} data={TGAR_LIQUIDITY} unit="percent" reference={100}
            stroke="#f59e0b" accessibleLabel="Liquidez dividida por rendimentos a distribuir em cada informe mensal, dezembro de 2024 a setembro de 2026" />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Informes B3/CVM: campo 9 ÷ campo 12, por competência. Linha 100% é só
            comparação contábil, não teste de solvência; sem informe de out/26.
          </p>
        </div>
      </div>

      <details className="rounded-lg border border-gray-200 dark:border-gray-700">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
          Ver indicadores complementares (8)
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
            patrimônio, reserva, equity, caixa, liquidez, alavancagem e P/VP
          </span>
        </summary>
        <div className="space-y-3 border-t border-gray-200 p-3 dark:border-gray-700">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Fact label="Reserva acumulada em out/25" value="R$ 0,18/cota"
                                  detail="18% da distribuição mensal de R$ 1,00" color="amber" />
            <Fact label="Receita de equity em out/25" value="76,06%"
                                  detail="Participação na receita mensal, não no patrimônio" color="amber" />

            <Fact label="Patrimônio por cota" value={`${navChange.toFixed(1).replace('.', ',')}%`}
              detail={`${consecutiveDrops} quedas mensais seguidas · ${money(startNav)} → ${money(endNav)}`} color="red" />
            <Fact label="Variação patrimonial em 2025 até out/25" value="−R$ 160,26 mi"
              detail="Marcações patrimoniais; diferente de prejuízo de caixa" color="red" />


          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Fact label="Cobertura de caixa no 1º semestre de 2025" value="99,5%"
              detail="R$ 140,69 mi gerados ÷ R$ 141,41 mi distribuídos" color="amber" />
            <Fact label="Liquidez informada em nov/25" value="R$ 9,08 mi"
              detail="Rendimentos a distribuir: R$ 23,6 mi · não é teste de solvência" color="amber" />
            <Fact label="Alavancagem informada em nov/25" value="0,20%"
              detail="Dívidas em relação ao patrimônio, conforme informe" />
            <Fact label="P/VP na compra (aproximado)" value={pvp === null ? 'Sem preço' : `${pvp.toFixed(2).replace('.', ',')}x`}
              detail={pvp === null ? 'Valor de compra não recebido' : `${money(price)} ÷ VP publicado de ${money(endNav)}`} />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cores locais: quedas patrimoniais consecutivas e variação patrimonial negativa em vermelho;
            reservas pequenas, concentração de receitas e cobertura inferior a 100% em amarelo.
            Não são classificações oficiais e não representam previsão de preço.
          </p>
        </div>
      </details>
      <div className="flex flex-wrap gap-3 text-xs text-blue-600 dark:text-blue-400">
        {SOURCES.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:underline">
            {source.label} <ArrowUpRight size={12} />
          </a>
        ))}
      </div>
    </div>
  );
}
