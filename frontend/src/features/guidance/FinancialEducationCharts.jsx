import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Label,
  LabelList,
  LineChart,
  Line,
  AreaChart,
  Area,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import {
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  Percent,
  Activity,
  Info,
  Database,
  Rocket,
  Ban,
  Scale,
  Zap,
  Clock,
  Anchor,
  Layers,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';

const RISK_FREE_RATE = 10.65;

const SHARPE_RANGES = [
  {
    min: -999,
    max: 0,
    label: 'Pior que renda fixa',
    description: 'O ativo não compensa o risco. Retorno inferior à taxa livre de risco.',
    color: 'red',
  },
  {
    min: 0,
    max: 0.5,
    label: 'Risco alto para pouco retorno',
    description: 'Alta volatilidade com retorno ineficiente. Grande chance de erro emocional.',
    color: 'orange',
  },
  {
    min: 0.5,
    max: 1.0,
    label: 'Aceitável, mas sofrido',
    description: 'Retorno razoável, porém com oscilações que podem testar a disciplina.',
    color: 'yellow',
  },
  {
    min: 1.0,
    max: 1.2,
    label: 'Bom equilíbrio',
    description: 'Crescimento consistente com volatilidade controlada.',
    color: 'green',
  },
  {
    min: 1.2,
    max: 2.0,
    label: 'Retorno eficiente',
    description: 'Excelente relação entre retorno e risco. Ativo sustentável.',
    color: 'blue',
  },
  {
    min: 2.0,
    max: 999,
    label: 'Excepcional',
    description: 'Retorno muito alto para o risco assumido. Geralmente temporário.',
    color: 'purple',
  },
];

const getSharpeInfo = (value) => {
  return SHARPE_RANGES.find((r) => value >= r.min && value < r.max) || SHARPE_RANGES[0];
};

const getFormattedDate = (daysOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
};

export const formatDateLong = (dateStr) => {
  if (!dateStr) return 'Início';

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (isNaN(date.getTime())) return dateStr;

  const dayFormatted = String(date.getDate()).padStart(2, '0');
  const monthFormatted = date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
  const yearFormatted = date.getFullYear();

  return `${dayFormatted}/${monthFormatted}/${yearFormatted}`;
};

const getCurrentYear = (yearOffset = 0) => {
  return new Date().getFullYear() + yearOffset;
};

const ACTION_LABELS_PT = {
  BUY: 'COMPRAR',
  WAIT: 'AGUARDAR',
  PANIC: 'PÂNICO',
  BLOCKED: 'BLOQUEADO',
};

const RAW_CRASH_SCENARIO = [
  { day: getFormattedDate(-5), price: 100, mm200: 102, action_naive: 'BUY', action_mm200: 'WAIT' },
  { day: getFormattedDate(-4), price: 90, mm200: 101, action_naive: 'BUY', action_mm200: 'WAIT' },
  { day: getFormattedDate(-3), price: 80, mm200: 99, action_naive: 'BUY', action_mm200: 'WAIT' },
  { day: getFormattedDate(-2), price: 70, mm200: 97, action_naive: 'BUY', action_mm200: 'WAIT' },
  { day: getFormattedDate(-1), price: 60, mm200: 94, action_naive: 'BUY', action_mm200: 'WAIT' },
  { day: getFormattedDate(0), price: 50, mm200: 90, action_naive: 'PANIC', action_mm200: 'WAIT' },
];

const DRAWDOWN_DATA = [
  { loss: 10, recovery: 11.1, risk: 'low', label: 'Leve' },
  { loss: 20, recovery: 25.0, risk: 'low', label: 'Atenção' },
  { loss: 30, recovery: 42.9, risk: 'medium', label: 'Moderado' },
  { loss: 40, recovery: 66.7, risk: 'medium', label: 'Alto' },
  { loss: 50, recovery: 100.0, risk: 'high', label: 'Crítico' },
  { loss: 60, recovery: 150.0, risk: 'critical', label: 'Grave' },
  { loss: 70, recovery: 233.3, risk: 'critical', label: 'Colapso' },
  { loss: 80, recovery: 400.0, risk: 'game_over', label: 'Game Over' },
  { loss: 90, recovery: 900.0, risk: 'game_over', label: 'Falência' },
];

const CAGR_SCENARIO_DATA = [
  { year: getCurrentYear(0), val_real: 10000, val_illusion: 10000, pct: 0 },
  { year: getCurrentYear(1), val_real: 15000, val_illusion: 10500, pct: 50 },
  { year: getCurrentYear(2), val_real: 9000, val_illusion: 11025, pct: -40 },
  { year: getCurrentYear(3), val_real: 13500, val_illusion: 11576, pct: 50 },
  { year: getCurrentYear(4), val_real: 8100, val_illusion: 12155, pct: -40 },
  { year: getCurrentYear(5), val_real: 12150, val_illusion: 12762, pct: 50 },
  { year: getCurrentYear(6), val_real: 7290, val_illusion: 13400, pct: -40 },
];

const CAGR_COMPARISON_DATA = [
  { name: 'Média Aritmética', value: 5.0, type: 'illusion', label: 'Ilusão' },
  { name: 'CAGR Real', value: -5.1, type: 'real', label: 'Realidade' },
];

const getRiskHex = (risk, isDark) => {
  switch (risk) {
    case 'low':
      return '#10b981';
    case 'medium':
      return '#eab308';
    case 'high':
      return '#f97316';
    case 'critical':
      return '#ef4444';
    case 'game_over':
      return '#9333ea';
    default:
      return '#9ca3af';
  }
};

const CustomDrawdownTooltip = ({ active, payload, isDark }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const bgClass = isDark
      ? 'bg-gray-800 border-gray-600 text-gray-200'
      : 'bg-white border-gray-300 text-gray-700';
    return (
      <div className={`${bgClass} border p-3 rounded-lg shadow-xl text-sm z-50`}>
        <div className="border-b border-gray-500/20 pb-2 mb-2">
          <p className="font-bold text-xs uppercase tracking-wider opacity-70">Cenário de Queda</p>
          <p className="text-lg font-bold text-red-500">-{data.loss}%</p>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between gap-8 text-xs">
            <span className="text-gray-500 dark:text-gray-400">Capital Restante:</span>
            <span className="font-mono font-bold">{100 - data.loss}%</span>
          </div>
          <div className="flex justify-between gap-8 items-center">
            <span className="font-bold text-indigo-500 dark:text-indigo-400">
              Recuperação Necessária:
            </span>
            <span className="font-mono font-bold text-lg text-indigo-600 dark:text-indigo-300">
              +{data.recovery.toLocaleString('pt-BR')}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const CustomStrategyTooltip = ({ active, payload, isDark, mode, isHypothetical }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const price = data.price;
    const isNaive = mode === 'naive';
    const bgClass = isDark
      ? 'bg-gray-900 border-gray-700 text-gray-100'
      : 'bg-white border-gray-200 text-gray-800 shadow-xl';

    const labelColor = isDark ? 'text-gray-400' : 'text-gray-500';
    const subLabelColor = isDark ? 'text-gray-500' : 'text-gray-400';
    const separatorColor = isDark ? 'border-gray-700' : 'border-gray-100';

    return (
      <div className={`${bgClass} border text-xs p-3 rounded-lg z-50 min-w-[200px]`}>
        <div
          className={`flex justify-between items-center gap-6 mb-2 pb-2 border-b ${separatorColor}`}
        >
          <span className={`font-bold uppercase ${labelColor}`}>{data.day}</span>
          <span className="font-mono font-bold">Cotação: R$ {price.toFixed(2)}</span>
        </div>

        {isHypothetical ? (
          <>
            {isNaive && data.naiveStats && (
              <div className={`mb-3 pb-2 border-b ${separatorColor}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={subLabelColor}>Quantidade:</span>
                  <span className="font-mono">x{data.naiveStats.shares}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={subLabelColor}>Preço Médio (PM):</span>
                  <span className="font-mono text-orange-500 font-bold">
                    R$ {data.naiveStats.avgPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {isNaive && data.naiveStats && (
              <div className="mb-3">
                <p className={`text-[10px] uppercase tracking-wider mb-1 font-bold ${labelColor}`}>
                  Resultado Financeiro
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
                  <span className={`text-left ${subLabelColor}`}>Investido:</span>
                  <span className="font-mono text-gray-400 line-through decoration-red-400/50">
                    R$ {data.naiveStats.invested.toFixed(0)}
                  </span>
                  <span className={`text-left ${subLabelColor}`}>Atual:</span>
                  <span className="font-mono font-bold">
                    R$ {data.naiveStats.equity.toFixed(0)}
                  </span>
                </div>
                <div
                  className={`mt-2 pt-1 border-t ${separatorColor} flex justify-between items-center`}
                >
                  <span className="text-[10px] text-gray-500">Rentabilidade:</span>
                  <span
                    className={`text-base font-bold ${data.naiveStats.variation < 0 ? 'text-red-500' : 'text-green-500'}`}
                  >
                    {data.naiveStats.variation > 0 ? '+' : ''}
                    {data.naiveStats.variation.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            <div
              className={`flex items-center justify-between gap-4 p-1.5 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
            >
              <span className="text-[10px] uppercase font-bold text-gray-500">Ação Sugerida:</span>
              <span
                className={`font-bold ${isNaive ? (data.action_naive === 'PANIC' ? 'text-red-600' : 'text-orange-500') : 'text-green-600'}`}
              >
                {isNaive
                  ? ACTION_LABELS_PT[data.action_naive]
                  : ACTION_LABELS_PT[data.action_mm200]}
              </span>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Média (MM200):</span>
              <span className="font-mono text-orange-500">R$ {data.mm200.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2 border-t pt-1 border-gray-100 dark:border-gray-700">
              <span className="text-gray-500">Distância:</span>
              <span
                className={`font-bold ${data.price > data.mm200 ? 'text-green-500' : 'text-red-500'}`}
              >
                {(((data.price - data.mm200) / data.mm200) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const CustomCagrTooltip = ({ active, payload, isDark, mode }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isIllusion = mode === 'illusion';
    const displayValue = isIllusion ? data.val_illusion : data.val_real;
    const baseline = 10000;
    const variation = ((displayValue - baseline) / baseline) * 100;
    const isPositive = variation >= 0;
    const bgClass = isDark
      ? 'bg-gray-900 border-gray-700 text-gray-100'
      : 'bg-white border-gray-200 text-gray-800 shadow-xl';

    return (
      <div className={`${bgClass} border text-xs p-3 rounded-lg z-50 min-w-[180px]`}>
        <div className="border-b border-gray-500/20 pb-2 mb-2 flex justify-between items-center">
          <span className="font-bold text-gray-500 uppercase">Ano {data.year}</span>
          <span className={`font-bold ${data.pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {data.year === getCurrentYear(0)
              ? 'Início'
              : `${data.pct > 0 ? '+' : ''}${data.pct}% no ano`}
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase text-gray-500">Patrimônio Acumulado</p>
          <p className="text-xl font-bold font-mono">
            R$ {displayValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
          </p>
          <div
            className={`flex items-center gap-1 mt-1 font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}
          >
            {isPositive ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingUp size={14} className="rotate-180" />
            )}
            {variation.toFixed(1)}% Total
          </div>
        </div>
        {isIllusion && (
          <div className="mt-3 pt-2 border-t border-gray-500/20 text-[10px] text-blue-500 italic">
            *Projeção linear baseada na média simples
          </div>
        )}
      </div>
    );
  }
  return null;
};

const AssetBadge = ({ name, isHypothetical }) => (
  <div
    className={`flex items-center gap-1.5 px-2 py-1 rounded border self-end md:self-auto mb-2 md:mb-0 
    ${
      isHypothetical
        ? 'bg-gray-100 border-gray-200 text-gray-600 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300'
        : 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300'
    }`}
  >
    <Database size={10} />
    <span className="text-[10px] font-mono font-bold uppercase tracking-wide">
      {isHypothetical ? 'Simulação: Hipotético' : `Ativo Real: ${name}`}
    </span>
  </div>
);

export const StrategySimulator = ({ asset }) => {
  const [mode, setMode] = useState('naive');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisTextColor = isDark ? '#9ca3af' : '#6b7280';

  const isHypothetical = !asset;
  const isNaive = mode === 'naive';

  const chartData = useMemo(() => {
    if (isHypothetical) {
      let accumulatedShares = 0;
      let accumulatedInvested = 0;

      return RAW_CRASH_SCENARIO.map((day) => {
        if (day.action_naive === 'BUY' || day.action_naive === 'PANIC') {
          accumulatedShares += 1;
          accumulatedInvested += day.price;
        }

        const equityNaive = accumulatedShares * day.price;
        const avgPrice = accumulatedShares > 0 ? accumulatedInvested / accumulatedShares : 0;
        const variationNaive =
          accumulatedInvested > 0
            ? ((equityNaive - accumulatedInvested) / accumulatedInvested) * 100
            : 0;

        return {
          ...day,
          naiveStats: {
            shares: accumulatedShares,
            invested: accumulatedInvested,
            equity: equityNaive,
            avgPrice: avgPrice,
            variation: variationNaive,
          },
        };
      });
    }

    const points = [];
    const dataPoints = 20;
    const daysTotal = 180;
    const stepDays = Math.floor(daysTotal / dataPoints);

    const isUptrend = asset.momentum;

    const priceStartFactor = isUptrend ? 0.85 : 1.15;
    const mmStartFactor = isUptrend ? 0.9 : 1.05;

    for (let i = dataPoints; i >= 0; i--) {
      const progress = 1 - i / dataPoints;

      const dayLabel = i === 0 ? 'Hoje' : getFormattedDate(-(i * stepDays));

      const projectedMM = asset.mm200 * (mmStartFactor + (1 - mmStartFactor) * progress);

      const noise = i === 0 ? 0 : Math.sin(progress * Math.PI * 3) * (asset.price * 0.04);
      const basePrice = asset.price * (priceStartFactor + (1 - priceStartFactor) * progress);
      const projectedPrice = basePrice + noise;

      points.push({
        day: dayLabel,
        price: projectedPrice,
        mm200: projectedMM,
        action: projectedPrice > projectedMM ? 'MANTER' : 'AGUARDAR',
      });
    }

    return points;
  }, [asset, isHypothetical]);

  const config = useMemo(() => {
    if (isHypothetical) {
      return {
        title: isNaive ? 'Estratégia "Preço Médio" (Erro)' : 'Proteção MM200 (Solução)',
        desc: isNaive ? 'Comprando durante a queda (faca caindo)' : 'Evitando perdas catastróficas',
        icon: isNaive ? (
          <ShieldAlert className="text-red-500" />
        ) : (
          <ShieldCheck className="text-green-500" />
        ),
        messageTitle: isNaive ? 'O Problema:' : 'A Solução:',
        message: isNaive
          ? '"Tô achando barato!" Você compra a 100, 90, 80... seu capital investido aumenta enquanto o ativo cai.'
          : 'Abaixo da MM200, o sistema desaconselha novas compras. Você preserva dinheiro para comprar na virada',
        color: isNaive ? 'red' : 'green',
      };
    } else {
      const isGood = asset.momentum;
      return {
        title: `Análise Técnica (Tendência Primária)`,
        desc: isGood
          ? `Tendência de Alta nos últimos meses`
          : `Tendência de Baixa nos últimos meses`,
        icon: isGood ? <TrendingUp className="text-green-500" /> : <Ban className="text-red-500" />,
        messageTitle: isGood ? 'Configuração Top Ranking:' : 'Bloqueio de Segurança:',
        message: isGood
          ? `O preço (R$ ${asset.price}) está trabalhando ACIMA da média de 200 dias (R$ ${asset.mm200}). O mercado vem pagando cada vez mais caro ao longo do tempo.`
          : `O preço (R$ ${asset.price}) perdeu a média de 200 (R$ ${asset.mm200}). Estatisticamente, ativos abaixo dessa média tendem a continuar caindo ou andar de lado.`,
        color: isGood ? 'indigo' : 'gray',
      };
    }
  }, [isHypothetical, isNaive, asset]);

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;

    if (!isHypothetical) {
      const isToday = payload.day === 'Hoje';

      return (
        <circle
          cx={cx}
          cy={cy}
          r={isToday ? 5 : 3}
          fill={asset.momentum ? '#10b981' : '#ef4444'}
          stroke="white"
          strokeWidth={isToday ? 2 : 1}
          style={{ cursor: 'pointer' }}
        />
      );
    }

    if (isNaive && payload.action_naive === 'PANIC') {
      return (
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={20}>
          💀
        </text>
      );
    }
    const color = isNaive ? '#ef4444' : '#10b981';

    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={color}
        stroke="white"
        strokeWidth={2}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-start justify-between mb-4 gap-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${config.color}-100 dark:bg-${config.color}-900/30`}>
            {config.icon}
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-base">{config.title}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">{config.desc}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <AssetBadge name={asset?.ticker} isHypothetical={isHypothetical} />
          {isHypothetical && (
            <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex text-xs font-bold w-fit">
              <button
                onClick={() => setMode('naive')}
                className={`px-3 py-1.5 rounded-md transition-all ${isNaive ? 'bg-white text-red-600 shadow-sm dark:bg-gray-600 dark:text-red-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                Ingênuo
              </button>
              <button
                onClick={() => setMode('mm200')}
                className={`px-3 py-1.5 rounded-md transition-all ${!isNaive ? 'bg-white text-green-600 shadow-sm dark:bg-gray-600 dark:text-green-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                Com MM200
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className={`mb-4 p-3 rounded-lg text-sm border 
        ${config.color === 'red' ? 'bg-red-50 border-red-100 text-red-800 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-200' : ''}
        ${config.color === 'green' ? 'bg-green-50 border-green-100 text-green-800 dark:bg-green-900/10 dark:border-green-900/30 dark:text-green-200' : ''}
        ${config.color === 'indigo' ? 'bg-indigo-50 border-indigo-100 text-indigo-800 dark:bg-indigo-900/10 dark:border-indigo-900/30 dark:text-indigo-200' : ''}
        ${config.color === 'gray' ? 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-700/30 dark:border-gray-600 dark:text-gray-300' : ''}
      `}
      >
        <p>
          <strong>{config.messageTitle}</strong> {config.message}
        </p>
      </div>

      <div className="w-full h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

            <XAxis
              dataKey="day"
              hide={false}
              interval={isHypothetical ? 0 : 4}
              tick={{ fontSize: 10, fill: axisTextColor }}
              axisLine={false}
              tickLine={false}
              dy={5}
            />

            <YAxis
              domain={['auto', 'auto']}
              hide={false}
              width={45}
              tickFormatter={(val) => `R$${val.toFixed(0)}`}
              tick={{ fontSize: 10, fill: axisTextColor }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              content={
                <CustomStrategyTooltip
                  isDark={isDark}
                  mode={mode}
                  isHypothetical={isHypothetical}
                />
              }
            />

            <Line
              type="monotone"
              dataKey="mm200"
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              animationDuration={1500}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={
                isHypothetical && isNaive
                  ? '#ef4444'
                  : asset?.momentum || !isNaive
                    ? '#10b981'
                    : '#ef4444'
              }
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 6, strokeWidth: 0 }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {isHypothetical && (
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Resultado Final
          </span>
          <span className={`text-xl font-bold ${isNaive ? 'text-red-600' : 'text-green-500'}`}>
            {isNaive ? '-33% de Perda' : '0% (Caixa Intacto)'}
          </span>
        </div>
      )}
    </div>
  );
};

export const CagrSimulator = ({ asset }) => {
  const [mode, setMode] = useState('real');
  const [activeTab, setActiveTab] = useState('CAGR');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axisTextColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  const isHypothetical = !asset;
  const isIllusion = mode === 'illusion';

  const mainColor = isHypothetical && isIllusion ? '#3b82f6' : '#9333ea';

  const calcStart = asset?.calc_window?.start;
  const calcEnd = asset?.calc_window?.end;
  const daysCount = asset?.calc_window?.days || 252;

  const config = useMemo(() => {
    if (isHypothetical) {
      if (isIllusion) {
        return {
          title: 'Expectativa (Média Simples)',
          desc: 'O erro de somar % e dividir',
          icon: <Activity className="text-blue-500" />,
          messageTitle: 'A Ilusão da Planilha:',
          message:
            'Se você ganha 50% e depois perde 40%, a média aritmética diz que você ganhou 5%. Parece um crescimento suave e constante, mas é matematicamente falso.',
          color: 'blue',
        };
      } else {
        return {
          title: 'Realidade (CAGR)',
          desc: 'O impacto real da volatilidade',
          icon: <Rocket className="text-purple-600 dark:text-purple-400" />,
          messageTitle: 'O Custo da Volatilidade:',
          message:
            'Na vida real, ganhar 50% e perder 40% resulta em PREJUÍZO de -10% sobre o capital. O CAGR desconta esses solavancos e mostra o crescimento verdadeiro.',
          color: 'purple',
        };
      }
    } else {
      if (activeTab === 'SHARPE') {
        const sharpeInfo = getSharpeInfo(asset.sharpe);
        return {
          title: `Risco Sharpe (${asset.ticker})`,
          desc: 'Eficiência Risco vs Retorno',
          icon: <Layers className="text-orange-500" />,
          messageTitle: `${sharpeInfo.label}:`,
          message: sharpeInfo.description,
          color: sharpeInfo.color,
        };
      } else {
        const isGood = asset.cagr > 10;
        return {
          title: `Projeção (${asset.ticker})`,
          desc: isGood ? 'Alta Aceleração Histórica' : 'Crescimento Moderado/Baixo',
          icon: <Zap className={isGood ? 'text-purple-600' : 'text-gray-500'} />,
          messageTitle: isGood ? 'Motor Potente:' : 'Desempenho:',
          message: isGood
            ? `Este ativo tem entregado ${asset.cagr}% ao ano. Se mantiver esse ritmo, o capital dobra a cada ${(72 / asset.cagr).toFixed(1)} anos.`
            : `O crescimento atual é de ${asset.cagr}%. É positivo, mas exige paciência.`,
          color: isGood ? 'purple' : 'gray',
        };
      }
    }
  }, [isHypothetical, asset, isIllusion, activeTab]);

  const sharpeData = useMemo(() => {
    if (!asset || activeTab !== 'SHARPE') return null;

    const excessReturn = asset.cagr - RISK_FREE_RATE;
    let impliedVolatility = 0;

    if (asset.sharpe !== 0) {
      impliedVolatility = Math.abs(excessReturn / asset.sharpe);
    }

    return {
      rp: asset.cagr,
      rf: RISK_FREE_RATE,
      sigma: impliedVolatility,
      excess: excessReturn,
    };
  }, [asset, activeTab]);

  const chartData = useMemo(() => {
    if (isHypothetical) {
      return CAGR_SCENARIO_DATA.map((d) => ({
        ...d,
        label: d.year.toString(),

        displayValue: isIllusion ? d.val_illusion : d.val_real,
        isProjection: false,
      }));
    }

    if (activeTab === 'SHARPE') return [];

    const data = [];
    const currentPrice = asset.price || 100;
    const rate = asset.cagr / 100;
    const startPrice = currentPrice / (1 + rate);

    data.push({
      label: formatDateLong(calcStart),
      fullDate: `Início Cálculo (${formatDateLong(calcStart)})`,
      displayValue: startPrice,
      isReal: true,
      annotation: 'Início Janela',
    });

    data.push({
      label: 'Hoje',
      fullDate: `Hoje (${formatDateLong(calcEnd)})`,
      displayValue: currentPrice,
      isReal: true,
      annotation: 'Preço Atual',
    });

    const projectedPrice = currentPrice * (1 + rate);
    data.push({
      label: 'Projeção 1A',
      fullDate: 'Projeção (1 Ano)',
      displayValue: projectedPrice,
      isReal: false,
      annotation: 'Se repetir CAGR',
    });

    return data;
  }, [asset, isHypothetical, calcStart, calcEnd, isIllusion, activeTab]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col h-full relative overflow-hidden transition-all duration-300">
      {}
      <div className="flex flex-col md:flex-row md:items-start justify-between mb-4 gap-2 z-10">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${config.color}-100 dark:bg-${config.color}-900/30`}>
            {config.icon}
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-base">{config.title}</h4>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">{config.desc}</p>
              {!isHypothetical && activeTab !== 'SHARPE' && (
                <span className="text-[10px] text-gray-500 flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                  <Clock size={10} /> {daysCount}d
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <AssetBadge name={asset?.ticker} isHypothetical={isHypothetical} />

          {}
          {isHypothetical ? (
            <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex text-xs font-bold w-fit">
              <button
                onClick={() => setMode('illusion')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  isIllusion
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-600 dark:text-blue-300'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Média Simples
              </button>
              <button
                onClick={() => setMode('real')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  !isIllusion
                    ? 'bg-white text-purple-600 shadow-sm dark:bg-gray-600 dark:text-purple-300'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                CAGR Real
              </button>
            </div>
          ) : (
            <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex text-xs font-bold w-fit">
              <button
                onClick={() => setActiveTab('CAGR')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'CAGR'
                    ? 'bg-white text-purple-600 shadow-sm dark:bg-gray-600 dark:text-purple-300'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                CAGR %
              </button>
              <button
                onClick={() => setActiveTab('SHARPE')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'SHARPE'
                    ? 'bg-white text-orange-600 shadow-sm dark:bg-gray-600 dark:text-orange-300'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Sharpe
              </button>
            </div>
          )}
        </div>
      </div>

      {}
      <div
        className={`mb-4 p-3 rounded-lg text-sm border z-10 transition-colors duration-300
        ${config.color === 'purple' ? 'bg-purple-50 border-purple-100 text-purple-900 dark:bg-purple-900/10 dark:border-purple-900/30 dark:text-purple-200' : ''}
        ${config.color === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-900 dark:bg-blue-900/10 dark:border-blue-900/30 dark:text-blue-200' : ''}
        ${config.color === 'gray' ? 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-700/30 dark:border-gray-600 dark:text-gray-300' : ''}
        ${config.color === 'green' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-200' : ''}
        ${config.color === 'yellow' ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/10 dark:border-yellow-900/30 dark:text-yellow-200' : ''}
        ${config.color === 'orange' ? 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/10 dark:border-orange-900/30 dark:text-orange-200' : ''}
        ${config.color === 'red' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-200' : ''}
      `}
      >
        <p>
          <strong>{config.messageTitle}</strong> {config.message}
        </p>
      </div>

      {}
      <div className="w-full flex-1 min-h-[12rem] mt-auto z-10 flex flex-col justify-center">
        {!isHypothetical && activeTab === 'SHARPE' && sharpeData ? (
          <div className="flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
            {}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded border border-gray-100 dark:border-gray-600 text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">
                  Seu investimetno
                </div>
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  {sharpeData.rp.toFixed(1)}%
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded border border-gray-100 dark:border-gray-600 text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">
                  Se fosse renda fixa
                </div>
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  {sharpeData.rf.toFixed(1)}%
                </div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-100 dark:border-orange-900/30 text-center">
                <div className="text-[10px] text-orange-600 dark:text-orange-400 uppercase font-bold mb-1">
                  Volatilidade
                </div>
                <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  {sharpeData.sigma.toFixed(1)}%
                </div>
              </div>
            </div>

            {}
            <div className="flex items-center justify-center gap-3 py-2">
              <div className="flex flex-col items-center">
                <div className="border-b-2 border-gray-300 dark:border-gray-600 px-2 pb-1 mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                  <span
                    className="text-green-600 dark:text-green-400 font-bold"
                    title="Prêmio de Risco"
                  >
                    {sharpeData.excess.toFixed(1)}%
                  </span>
                  <span className="text-[9px] mx-1 text-gray-400">(Excesso)</span>
                </div>
                <div className="text-xs font-bold text-orange-500" title="Volatilidade (Risco)">
                  {sharpeData.sigma.toFixed(1)}%
                </div>
              </div>
              <div className="text-xl font-bold text-gray-400">=</div>
              <div className={`text-4xl font-black text-${config.color}-500`}>
                {asset.sharpe.toFixed(2)}
              </div>
            </div>

            {}
            <div className="w-full mt-2">
              <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                {}
                <div
                  className="absolute top-0 bottom-0 w-1.5 bg-gray-800 dark:bg-white border-white dark:border-gray-900 shadow-lg z-20 transition-all duration-1000 ease-out"
                  style={{
                    left: `${Math.min(Math.max((asset.sharpe + 0.5) * 33, 0), 100)}%`,
                  }}
                />
                {}
                <div className="absolute inset-0 opacity-60 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500" />
              </div>

              <div className="flex justify-between mt-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                <span>Ruim (-0.5)</span>
                <span>Neutro (1.0)</span>
                <span>Bom (2.5)</span>
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="colorCagr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={mainColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={mainColor} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: axisTextColor }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis hide domain={['auto', 'auto']} />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-600 rounded shadow-lg text-xs z-50">
                        <p className="font-bold mb-1 border-b border-gray-100 dark:border-gray-700 pb-1">
                          {isHypothetical ? `Ano ${d.year}` : d.fullDate}
                        </p>
                        <div className="flex justify-between gap-4 mt-1">
                          <span className="text-gray-500">Valor:</span>
                          <span style={{ color: mainColor }} className="font-mono font-bold">
                            R${' '}
                            {d.displayValue?.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        {isHypothetical && (
                          <div className="text-[10px] text-gray-400 mt-1">
                            Rentabilidade Anual:{' '}
                            <span className={d.pct >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {d.pct}%
                            </span>
                          </div>
                        )}
                        {!isHypothetical && d.annotation && (
                          <p className="text-[10px] text-gray-400 mt-1 italic">{d.annotation}</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {!isHypothetical && chartData.length >= 2 && (
                <ReferenceArea
                  x1={chartData[0].label}
                  x2={chartData[1].label}
                  fill={isDark ? '#374151' : '#e5e7eb'}
                  fillOpacity={0.3}
                />
              )}

              <Area
                type="monotone"
                dataKey="displayValue"
                stroke={mainColor}
                strokeWidth={3}
                fill="url(#colorCagr)"
                dot={{ r: 4, fill: mainColor, strokeWidth: 2, stroke: isDark ? '#1f2937' : '#fff' }}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {isHypothetical && (
        <div className="mt-4 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs">
          <span className="text-gray-500 uppercase font-bold">Resultado Final (Ano 6)</span>
          <div className="flex gap-4">
            {isIllusion ? (
              <span className="font-bold text-blue-600">R$ 13.400 (Irreal)</span>
            ) : (
              <span className="font-bold text-purple-600">R$ 7.290 (Real)</span>
            )}
          </div>
        </div>
      )}

      {}
      {!isHypothetical && activeTab === 'CAGR' && (
        <div className="mt-4 pt-2 border-t border-gray-100 dark:border-gray-700 text-right">
          <span className="text-xs font-bold text-gray-500">
            CAGR: <span className="text-purple-600">{asset?.cagr}%</span>
          </span>
        </div>
      )}
    </div>
  );
};

export const DrawdownAnalysis = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#9ca3af' : '#6b7280';
  const labelColor = isDark ? '#e5e7eb' : '#374151';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col p-6 h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-500" />
          <h4 className="font-bold text-gray-900 dark:text-white text-sm">
            Gráfico da Assimetria de Perdas
          </h4>
        </div>
      </div>
      <div className="w-full h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={DRAWDOWN_DATA}
            margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
            barSize={32}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="loss"
              tickFormatter={(val) => `-${val}%`}
              tick={{ fill: textColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            >
              <Label
                value="Perda Inicial (Drawdown)"
                position="insideBottom"
                dy={18}
                style={{ fill: labelColor, fontSize: 11, fontWeight: 600 }}
              />
            </XAxis>
            <YAxis
              tickFormatter={(val) => `+${val}%`}
              tick={{ fill: textColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={60}
            >
              <Label
                value="Recuperação Necessária"
                angle={-90}
                position="insideLeft"
                dx={-5}
                style={{ fill: labelColor, fontSize: 11, fontWeight: 600, textAnchor: 'middle' }}
              />
            </YAxis>
            <Tooltip
              content={<CustomDrawdownTooltip isDark={isDark} />}
              cursor={{ fill: isDark ? '#ffffff10' : '#00000005' }}
            />
            <Bar dataKey="recovery" radius={[4, 4, 0, 0]} animationDuration={1500}>
              {DRAWDOWN_DATA.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getRiskHex(entry.risk, isDark)} />
              ))}
              <LabelList
                dataKey="recovery"
                position="top"
                formatter={(val) => `${val}%`}
                style={{ fill: textColor, fontSize: 10 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 text-xs text-gray-600 dark:text-gray-300 text-center bg-gray-100 dark:bg-gray-700/50 p-3 rounded border border-gray-200 dark:border-gray-700">
        <p>Observe como a curva cresce exponencialmente...</p>
        <p className="font-bold text-red-600 dark:text-red-400 mt-1">
          Perder 50% de valor exige que a ação tenha 100% de ganho apenas para empatar
        </p>
      </div>
    </div>
  );
};

export const VolatilityImpact = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const labelColor = isDark ? '#e5e7eb' : '#374151';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col p-6 h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-purple-500" />
          <h4 className="font-bold text-gray-900 dark:text-white text-sm">
            Impacto da Volatilidade no Longo Prazo
          </h4>
        </div>
      </div>
      <div className="w-full h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={CAGR_COMPARISON_DATA}
            margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
            barSize={60}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: axisColor, fontSize: 11, fontWeight: 'bold' }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              tickFormatter={(val) => `${val}%`}
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke={axisColor} />
            <Tooltip
              cursor={{ fill: isDark ? '#ffffff10' : '#00000005' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div
                      className={`p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
                    >
                      <p className="font-bold text-sm">{data.name}</p>
                      <p
                        className={`text-lg font-bold ${data.value > 0 ? 'text-blue-500' : 'text-purple-500'}`}
                      >
                        {data.value > 0 ? '+' : ''}
                        {data.value}% ao ano
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 4, 4]}>
              {CAGR_COMPARISON_DATA.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.type === 'illusion' ? '#3b82f6' : '#9333ea'}
                />
              ))}
              <LabelList
                dataKey="value"
                position={(props) => (props.value > 0 ? 'top' : 'bottom')}
                formatter={(val) => `${val}%`}
                style={{ fill: labelColor, fontSize: 12, fontWeight: 'bold' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 text-xs text-gray-600 dark:text-gray-300 text-center bg-gray-100 dark:bg-gray-700/50 p-3 rounded border border-gray-200 dark:border-gray-700">
        <p className="mb-1">A "Média da Planilha" (Azul) diz que você ganha dinheiro.</p>
        <p className="font-bold text-purple-600 dark:text-purple-400">
          O "CAGR Real" (Roxo) revela que a volatilidade está comendo seu capital.
        </p>
      </div>
    </div>
  );
};

export const AsymmetryExplanation = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-full flex flex-col relative overflow-hidden">
      <div className="absolute -right-6 -top-6 opacity-[0.03] pointer-events-none">
        <ShieldCheck size={200} />
      </div>

      <div className="flex items-center gap-2 mb-6 z-10">
        <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg">
          <Scale size={20} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white leading-tight">
            Por que usar a MM200?
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            O custo da prudência vs. O custo da teimosia
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-8 items-end justify-center z-10 pb-4">
        <div className="flex-1 w-full group cursor-default">
          <div className="flex justify-between text-xs mb-2 font-medium text-gray-500 dark:text-gray-400">
            <span>Entrar "Atrasado"</span>
            <span className="text-orange-500 font-bold">+15% Custo</span>
          </div>
          <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded-t-lg relative w-full overflow-hidden">
            <div className="absolute bottom-0 w-full bg-orange-400/80 h-[25%] transition-all duration-500 group-hover:bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
              Proteção
            </div>
            <div className="absolute bottom-[25%] w-full border-t-2 border-dashed border-gray-400/50 text-[9px] text-gray-400 text-right px-1">
              MM200
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-orange-50 dark:bg-orange-900/10 p-2 rounded border border-orange-100 dark:border-orange-900/20">
            Você espera a tendência confirmar. Paga um pouco mais caro, mas evita o crash.
          </p>
        </div>

        <div className="text-gray-300 font-bold text-xl italic pb-12 self-center">VS</div>

        <div className="flex-1 w-full group cursor-default">
          <div className="flex justify-between text-xs mb-2 font-medium text-gray-500 dark:text-gray-400">
            <span>Segurar na Queda</span>
            <span className="text-red-600 dark:text-red-400 font-bold">+60% Custo</span>
          </div>
          <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded-t-lg relative w-full overflow-hidden">
            <div className="absolute bottom-0 w-full bg-red-500 h-[85%] transition-all duration-500 group-hover:bg-red-600 flex items-center justify-center text-white text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)]">
              Recuperação
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-100 dark:border-red-900/20">
            Se cair 40%, você precisa subir 66% só para empatar o que perdeu.{' '}
            <span className="font-bold text-red-600">
              Quedas muito grandes quebram como o jogo dos juros compostos funciona.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export const CagrExplanation = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-full flex flex-col relative overflow-hidden">
      <div className="absolute -right-6 -top-6 opacity-[0.03] pointer-events-none">
        <Zap size={200} />
      </div>

      <div className="flex items-center gap-2 mb-6 z-10">
        <div className="p-2 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg">
          <TrendingUp size={20} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white leading-tight">
            Por que priorizar o CAGR?
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Velocidade de crescimento vs. Ilusão de segurança
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-8 items-end justify-center z-10 pb-4">
        <div className="flex-1 w-full group cursor-default order-2 md:order-1">
          <div className="flex justify-between text-xs mb-2 font-medium text-gray-500 dark:text-gray-400">
            <span>Alta Velocidade (20%)</span>
            <span className="text-green-500 font-bold flex items-center gap-1">
              <Zap size={12} fill="currentColor" /> R$ 61.900
            </span>
          </div>
          <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded-t-lg relative w-full overflow-hidden flex items-end">
            <div className="w-full bg-purple-600 h-[90%] transition-all duration-500 group-hover:bg-purple-500 flex items-start justify-center text-white text-[10px] font-bold pt-2 shadow-[0_0_15px_rgba(147,51,234,0.4)]">
              Aceleração
            </div>
            <div className="absolute bottom-0 w-full h-1 bg-gray-300 dark:bg-gray-600"></div>
          </div>
          <div className="mt-3 bg-purple-50 dark:bg-purple-900/10 p-2 rounded border border-purple-100 dark:border-purple-900/20">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              <span className="font-bold text-purple-600 dark:text-purple-400">O Risco Real:</span>{' '}
              Você aceita volatilidade agora para ganhar <strong>tempo</strong>. Chega no objetivo
              anos antes.
            </p>
          </div>
        </div>

        <div className="text-gray-300 font-bold text-xl italic pb-20 md:pb-12 self-center order-1 md:order-2">
          VS
        </div>

        <div className="flex-1 w-full group cursor-default order-3">
          <div className="flex justify-between text-xs mb-2 font-medium text-gray-500 dark:text-gray-400">
            <span>"Segurança" (10%)</span>
            <span className="text-gray-500 font-bold">R$ 25.900</span>
          </div>
          <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded-t-lg relative w-full overflow-hidden flex items-end">
            <div className="w-full bg-gray-400 dark:bg-gray-500 h-[40%] transition-all duration-500 group-hover:bg-gray-400 flex items-start justify-center text-white text-[10px] font-bold pt-2">
              Lentidão
            </div>
            <div className="absolute top-2 right-2 text-gray-400 opacity-50">
              <Anchor size={16} />
            </div>
          </div>
          <div className="mt-3 bg-gray-50 dark:bg-gray-700/30 p-2 rounded border border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Parece seguro porque "não cai", mas o preço é invisível:{' '}
              <span className="underline decoration-dotted">crescer devagar demais.</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-2 text-center">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
          Simulação: R$ 10k em 10 anos
        </p>
      </div>
    </div>
  );
};
