import React, { useState, useEffect, useMemo } from 'react';
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
} from 'recharts';
import {
  TrendingUp,
  Target,
  AlertTriangle,
  Lock,
  CheckCircle2,
  BarChart2,
  ArrowRight,
  Info,
  ShieldAlert,
  ShieldCheck,
  Percent,
  Activity,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext.jsx';

const ACTION_LABELS_PT = {
  BUY: 'COMPRAR',
  WAIT: 'AGUARDAR',
  PANIC: 'PÂNICO',
  BLOCKED: 'BLOQUEADO',
};

const CRASH_SCENARIO = [
  { day: 'D1', price: 100, mm200: 102, action_naive: 'BUY', action_mm200: 'WAIT' },
  { day: 'D2', price: 90, mm200: 101, action_naive: 'BUY', action_mm200: 'WAIT' },
  { day: 'D3', price: 80, mm200: 99, action_naive: 'BUY', action_mm200: 'WAIT' },
  { day: 'D4', price: 70, mm200: 97, action_naive: 'BUY', action_mm200: 'WAIT' },
  { day: 'D5', price: 60, mm200: 94, action_naive: 'BUY', action_mm200: 'WAIT' },
  { day: 'D6', price: 50, mm200: 90, action_naive: 'PANIC', action_mm200: 'WAIT' },
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
  { year: 0, val_real: 10000, val_illusion: 10000, pct: 0 },
  { year: 1, val_real: 15000, val_illusion: 10500, pct: 50 },
  { year: 2, val_real: 9000, val_illusion: 11025, pct: -40 },
  { year: 3, val_real: 13500, val_illusion: 11576, pct: 50 },
  { year: 4, val_real: 8100, val_illusion: 12155, pct: -40 },
  { year: 5, val_real: 12150, val_illusion: 12762, pct: 50 },
  { year: 6, val_real: 7290, val_illusion: 13400, pct: -40 },
];

const CAGR_COMPARISON_DATA = [
  { name: 'Média Aritmética', value: 5.0, type: 'illusion', label: 'Ilusão' },
  { name: 'CAGR Real', value: -5.1, type: 'real', label: 'Realidade' },
];

const MOCK_MARKET_DATA = [
  { ticker: 'QQQQ11', type: 'ETF', price: 112.46, mm200: 98.2, cagr: 21.5, sharpe: 1.2 },
  { ticker: 'IVVB11', type: 'ETF', price: 280.0, mm200: 295.5, cagr: 18.2, sharpe: 0.4 },
  { ticker: 'BTLG11', type: 'FII', price: 102.11, mm200: 100.5, cagr: 12.8, sharpe: 0.9 },
  { ticker: 'WEGE3', type: 'STOCK', price: 43.85, mm200: 38.0, cagr: 15.4, sharpe: 1.1 },
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

const getTypeColor = (type) => {
  switch (type) {
    case 'STOCK':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'FII':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'ETF':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'LÍDER':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800';
    case 'SECUNDÁRIO':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
    case 'BLOQUEADO':
      return 'bg-gray-100 text-gray-500 dark:bg-gray-700/30 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    default:
      return 'bg-gray-100 text-gray-800';
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

const CustomStrategyTooltip = ({ active, payload, isDark, mode }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const price = data.price;
    const isNaive = mode === 'naive';

    const currentPatrimony = isNaive ? data.naiveStats.equity : 100;
    const investedCapital = isNaive ? data.naiveStats.invested : 100;
    const variation = isNaive ? data.naiveStats.variation : 0;
    const shares = isNaive ? data.naiveStats.shares : 0;
    const avgPrice = isNaive ? data.naiveStats.avgPrice : 0;
    const variationColor =
      variation < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400';
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
          <span className="font-mono font-bold">Cotação: R$ {price}</span>
        </div>
        {isNaive && (
          <div className={`mb-3 pb-2 border-b ${separatorColor}`}>
            <div className="flex justify-between items-center mb-1">
              <span className={subLabelColor}>Quantidade:</span>
              <span className="font-mono">x{shares}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={subLabelColor}>Preço Médio (PM):</span>
              <span className="font-mono">R$ {avgPrice.toFixed(2)}</span>
            </div>
          </div>
        )}
        <div className="mb-3">
          <p className={`text-[10px] uppercase tracking-wider mb-1 font-bold ${labelColor}`}>
            Resultado Financeiro
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
            <span className={`text-left ${subLabelColor}`}>Investido:</span>
            <span className="font-mono text-gray-400 line-through decoration-red-400/50">
              R$ {investedCapital.toFixed(0)}
            </span>
            <span className={`text-left ${subLabelColor}`}>Atual:</span>
            <span className="font-mono font-bold">R$ {currentPatrimony.toFixed(0)}</span>
          </div>
          <div className={`mt-2 pt-1 border-t ${separatorColor} flex justify-between items-center`}>
            <span className="text-[10px] text-gray-500">Rentabilidade:</span>
            <span className={`text-base font-bold ${variationColor}`}>
              {variation > 0 ? '+' : ''}
              {variation.toFixed(1)}%
            </span>
          </div>
        </div>
        <div
          className={`flex items-center justify-between gap-4 p-1.5 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
        >
          <span className="text-[10px] uppercase font-bold text-gray-500">Ação:</span>
          <span
            className={`font-bold ${isNaive ? (isDark ? 'text-white' : 'text-gray-900') : 'text-orange-500'}`}
          >
            {isNaive ? (ACTION_LABELS_PT[data.action_naive] ?? '—') : 'BLOQUEADO ⛔'}
          </span>
        </div>
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
            {data.year === 0 ? 'Início' : `${data.pct > 0 ? '+' : ''}${data.pct}% no ano`}
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
            *Projeção linear baseada em +5% de média
          </div>
        )}
      </div>
    );
  }
  return null;
};

const DrawdownChart = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#9ca3af' : '#6b7280';
  const labelColor = isDark ? '#e5e7eb' : '#374151';

  return (
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
  );
};

const StrategySimulator = () => {
  const [mode, setMode] = useState('naive');
  const isNaive = mode === 'naive';
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisColor = isDark ? '#9ca3af' : '#6b7280';

  const simulationData = useMemo(() => {
    let accumulatedShares = 0;
    let accumulatedInvested = 0;
    const initialCashMM200 = 100;
    return CRASH_SCENARIO.map((day) => {
      accumulatedShares += 1;
      accumulatedInvested += day.price;
      const equityNaive = accumulatedShares * day.price;
      const avgPrice = accumulatedInvested / accumulatedShares;
      const variationNaive = ((equityNaive - accumulatedInvested) / accumulatedInvested) * 100;
      const equityMM200 = initialCashMM200;
      const variationMM200 = 0;
      return {
        ...day,
        naiveStats: {
          shares: accumulatedShares,
          invested: accumulatedInvested,
          equity: equityNaive,
          avgPrice: avgPrice,
          variation: variationNaive,
        },
        mm200Stats: { equity: equityMM200, variation: variationMM200 },
      };
    });
  }, []);

  const lastDay = simulationData[simulationData.length - 1];
  const finalReturn = isNaive ? lastDay.naiveStats.variation : 0;

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    if (isNaive) {
      if (payload.action_naive === 'BUY') {
        return (
          <circle
            cx={cx}
            cy={cy}
            r={4}
            fill="#22c55e"
            stroke={isDark ? '#1f2937' : '#fff'}
            strokeWidth={2}
          />
        );
      }
      if (payload.action_naive === 'PANIC') {
        return (
          <text
            x={cx}
            y={cy - 10}
            textAnchor="middle"
            fill="#ef4444"
            fontSize={20}
            fontWeight="bold"
          >
            💀
          </text>
        );
      }
    } else {
      return (
        <g transform={`translate(${cx - 5},${cy - 5})`}>
          <rect width="10" height="10" fill="#f97316" rx="2" />
          <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="white" strokeWidth="1.5" />
        </g>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${isNaive ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-green-100 text-green-600 dark:bg-green-900/30'}`}
          >
            {isNaive ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-base">
              {isNaive ? 'Estratégia "Preço Médio"' : 'Filtro de Segurança MM200'}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isNaive
                ? 'Comprando durante a queda (acumulação)'
                : 'Evitando a faca caindo (Sistêmico)'}
            </p>
          </div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex text-xs font-bold">
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
      </div>
      <div
        className={`mb-4 p-3 rounded-lg text-sm border ${isNaive ? 'bg-red-50 border-red-100 text-red-800 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-200' : 'bg-green-50 border-green-100 text-green-800 dark:bg-green-900/10 dark:border-green-900/30 dark:text-green-200'}`}
      >
        {isNaive ? (
          <p>
            <strong>O Problema:</strong> "Tô achando barato!" Você compra a 100, 90, 80... tentando
            baixar o médio. Seu capital investido aumenta enquanto o ativo cai.
          </p>
        ) : (
          <p>
            <strong>A Solução:</strong> Abaixo da MM200 (Laranja), o sistema identifica tendência de
            baixa e <strong>BLOQUEIA</strong> novos aportes. Você fica em caixa e preserva o
            capital.
          </p>
        )}
      </div>
      <div className="w-full h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={simulationData} margin={{ top: 10, right: 30, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="day" hide />
            <YAxis
              domain={[40, 110]}
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<CustomStrategyTooltip isDark={isDark} mode={mode} />}
              cursor={{ stroke: axisColor, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Line
              type="monotone"
              dataKey="mm200"
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={isNaive ? '#ef4444' : isDark ? '#9ca3af' : '#6b7280'}
              strokeWidth={3}
              dot={<CustomDot />}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Resultado Final
        </span>
        <span className={`text-xl font-bold ${isNaive ? 'text-red-600' : 'text-green-500'}`}>
          {isNaive ? `${finalReturn.toFixed(0)}% de Perda` : '0% (Caixa Intacto)'}
        </span>
      </div>
    </div>
  );
};

const CagrSimulator = () => {
  const [mode, setMode] = useState('illusion');
  const isIllusion = mode === 'illusion';
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${isIllusion ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30'}`}
          >
            {isIllusion ? <Percent size={20} /> : <Activity size={20} />}
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-base">
              {isIllusion ? 'Média Aritmética (Ilusão)' : 'CAGR Real (Verdade)'}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isIllusion
                ? 'Ignorando o impacto da volatilidade'
                : 'O impacto real dos juros compostos'}
            </p>
          </div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex text-xs font-bold">
          <button
            onClick={() => setMode('illusion')}
            className={`px-3 py-1.5 rounded-md transition-all ${isIllusion ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-600 dark:text-blue-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            Média
          </button>
          <button
            onClick={() => setMode('real')}
            className={`px-3 py-1.5 rounded-md transition-all ${!isIllusion ? 'bg-white text-purple-600 shadow-sm dark:bg-gray-600 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            CAGR
          </button>
        </div>
      </div>
      <div
        className={`mb-4 p-3 rounded-lg text-sm border ${isIllusion ? 'bg-blue-50 border-blue-100 text-blue-800 dark:bg-blue-900/10 dark:border-blue-900/30 dark:text-blue-200' : 'bg-purple-50 border-purple-100 text-purple-800 dark:bg-purple-900/10 dark:border-purple-900/30 dark:text-purple-200'}`}
      >
        {isIllusion ? (
          <p>
            <strong>O Conto da Média:</strong> Se você ganha <strong>+50%</strong> e depois perde{' '}
            <strong>-40%</strong>, a média é <strong>+5%</strong>. O gráfico mostra essa linha
            bonita, te enganando.
          </p>
        ) : (
          <p>
            <strong>A Realidade Dura:</strong> Ganhar 50% e perder 40% destrói patrimônio. R$ 100
            vira R$ 150, que vira R$ 90. <strong>CAGR Negativo</strong> mesmo com média positiva!
          </p>
        )}
      </div>
      <div className="w-full h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={CAGR_SCENARIO_DATA}
            margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
          >
            <defs>
              <linearGradient id="colorIllusion" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="year" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={<CustomCagrTooltip isDark={isDark} mode={mode} />} />

            {isIllusion ? (
              <Area
                type="monotone"
                dataKey="val_illusion"
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorIllusion)"
                animationDuration={1000}
                dot={{ fill: '#3b82f6', stroke: '#fff', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }}
              />
            ) : (
              <Area
                type="monotone"
                dataKey="val_real"
                stroke="#9333ea"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorReal)"
                animationDuration={1000}
                dot={{ fill: '#9333ea', stroke: '#fff', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#9333ea' }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          {isIllusion ? 'Retorno Médio Esperado' : 'Dinheiro no Bolso'}
        </span>
        <span className={`text-xl font-bold ${isIllusion ? 'text-blue-600' : 'text-red-500'}`}>
          {isIllusion ? '+35% (Irreal)' : '-27% (Real)'}
        </span>
      </div>
    </div>
  );
};

const CagrComparisionChart = () => {
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

export default function WhereToInvest() {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState([]);
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    setTimeout(() => {
      const processed = MOCK_MARKET_DATA.map((asset) => {
        const momentum = asset.price > asset.mm200;
        const distMM200 = ((asset.price - asset.mm200) / asset.mm200) * 100;
        let status = momentum ? 'ELEGÍVEL' : 'BLOQUEADO';
        return { ...asset, momentum, distMM200, status };
      });
      const ranked = processed.sort((a, b) => b.cagr - a.cagr);
      let foundLeader = false;
      const finalRanked = ranked.map((asset) => {
        if (!asset.momentum) return { ...asset, status: 'BLOQUEADO' };
        if (!foundLeader) {
          foundLeader = true;
          return { ...asset, status: 'LÍDER' };
        }
        return { ...asset, status: 'SECUNDÁRIO' };
      });
      setAnalysis(finalRanked);
      const leader = finalRanked.find((a) => a.status === 'LÍDER');
      setRecommendation(leader || { type: 'CASH' });
      setLoading(false);
    }, 800);
  }, []);

  const maxCagr = useMemo(() => Math.max(...analysis.map((a) => a.cagr), 0), [analysis]);

  return (
    <div className="p-4 md:p-8 max-w-[90rem] mx-auto pb-20 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Target className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            Onde Aportar?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Algoritmo de decisão baseado em Trend Following (MM200) + Aceleração (CAGR)
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
          Calculando tendências e volatilidade...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {}
            <div className="lg:col-span-1 flex flex-col">
              <div
                className={`flex-1 rounded-xl shadow-sm border p-6 relative overflow-hidden flex flex-col ${recommendation.type === 'CASH' ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}
              >
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                  <Target size={180} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <div
                      className={`p-2 rounded-lg ${recommendation.type === 'CASH' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}
                    >
                      {recommendation.type === 'CASH' ? (
                        <AlertTriangle size={24} />
                      ) : (
                        <CheckCircle2 size={24} />
                      )}
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Ação Recomendada
                    </span>
                  </div>
                  {recommendation.type === 'CASH' ? (
                    <div>
                      <h3 className="text-3xl font-bold text-red-700 dark:text-red-400 mb-2">
                        SEGURAR CAIXA
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        Nenhum ativo apresenta tendência de alta segura (todos abaixo da MM200).
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-3 mb-1">
                        <h3 className="text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
                          {recommendation.ticker}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getTypeColor(recommendation.type)}`}
                        >
                          {recommendation.type}
                        </span>
                      </div>
                      <p className="text-green-600 dark:text-green-400 font-medium text-sm mb-8 flex items-center gap-1">
                        <TrendingUp size={16} /> Tendência de Alta Confirmada
                      </p>
                      <div className="space-y-5">
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700/50 pb-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Potencial (CAGR)
                          </span>
                          <span className="text-xl font-bold text-gray-900 dark:text-white">
                            {recommendation.cagr}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700/50 pb-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Distância MM200
                          </span>
                          <span className="text-xl font-bold text-green-600">
                            +{recommendation.distMM200.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700/50 pb-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Sharpe (Risco)
                          </span>
                          <span className="text-xl font-bold text-gray-900 dark:text-white">
                            {recommendation.sharpe}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-auto pt-8">
                  <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-[0.98]">
                    Registrar Aporte <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            {}
            <div className="lg:col-span-2">
              <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                      Ranking de Elegibilidade
                    </h3>
                  </div>
                  <div className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
                    SORT: CAGR (DESC)
                  </div>
                </div>
                <div className="space-y-6">
                  {analysis.map((asset, index) => {
                    const isLocked = asset.status === 'BLOQUEADO';
                    const widthPercentage = (asset.cagr / maxCagr) * 100;
                    return (
                      <div
                        key={asset.ticker}
                        className={`relative group ${isLocked ? 'opacity-50 grayscale-[0.8]' : ''}`}
                      >
                        <div className="flex items-center gap-4 text-sm mb-2">
                          <div className="w-6 text-gray-400 font-mono text-sm font-bold">
                            #{index + 1}
                          </div>
                          <div className="w-28 flex-shrink-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-lg text-gray-800 dark:text-gray-200">
                                {asset.ticker}
                              </span>
                              {isLocked && <Lock size={12} className="text-red-400" />}
                            </div>
                            <div
                              className={`text-[10px] uppercase font-bold w-fit px-1.5 py-0.5 rounded border ${getStatusColor(asset.status)}`}
                            >
                              {asset.status}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1.5 text-xs">
                              <span className="font-medium text-gray-500 dark:text-gray-400">
                                CAGR {asset.cagr}%
                              </span>
                              <span
                                className={`${asset.distMM200 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'} font-medium`}
                              >
                                MM200 {asset.distMM200 > 0 ? '+' : ''}
                                {asset.distMM200.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ${isLocked ? 'bg-gray-400' : 'bg-indigo-500'}`}
                                style={{ width: `${widthPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-4">
            <StrategySimulator />

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col p-6 h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-500" />
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                    Gráfico da Assimetria de Perdas
                  </h4>
                </div>
              </div>
              <DrawdownChart />
              <div className="mt-4 text-xs text-gray-600 dark:text-gray-300 text-center bg-gray-100 dark:bg-gray-700/50 p-3 rounded border border-gray-200 dark:border-gray-700">
                <p>Observe como a curva cresce exponencialmente...</p>
                <p className="font-bold text-red-600 dark:text-red-400 mt-1">
                  Perder 50% de valor exige que a ação tenha 100% de ganho apenas para empatar
                </p>
              </div>
            </div>

            <CagrSimulator />
            <CagrComparisionChart />
          </div>
        </>
      )}
    </div>
  );
}
