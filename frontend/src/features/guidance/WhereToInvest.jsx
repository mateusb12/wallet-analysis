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
  ReferenceLine,
  Label,
  LabelList,
} from 'recharts';
import {
  TrendingUp,
  Target,
  AlertTriangle,
  Lock,
  CheckCircle2,
  BarChart2,
  TrendingDown,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext.jsx';

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

const CustomDrawdownTooltip = ({ active, payload, label, isDark }) => {
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
          <div className="mt-2 pt-2 border-t border-gray-500/20 text-[10px] text-center italic opacity-60">
            Nível de Risco: {data.label}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const DrawdownChart = () => {
  let isDark = true;
  const { theme } = useTheme();
  isDark = theme === 'dark';

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
              style={{
                fill: labelColor,
                fontSize: 11,
                fontWeight: 600,
              }}
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
              style={{
                fill: labelColor,
                fontSize: 11,
                fontWeight: 600,
                textAnchor: 'middle',
              }}
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
              formatter={(val) => (val > 100 ? '' : `${val}%`)}
              style={{ fill: textColor, fontSize: 10 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
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

const MOCK_MARKET_DATA = [
  { ticker: 'QQQQ11', type: 'ETF', price: 112.46, mm200: 98.2, cagr: 21.5, sharpe: 1.2 },
  { ticker: 'IVVB11', type: 'ETF', price: 280.0, mm200: 295.5, cagr: 18.2, sharpe: 0.4 },
  { ticker: 'BTLG11', type: 'FII', price: 102.11, mm200: 100.5, cagr: 12.8, sharpe: 0.9 },
  { ticker: 'WEGE3', type: 'STOCK', price: 43.85, mm200: 38.0, cagr: 15.4, sharpe: 1.1 },
];

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
            <div className="lg:col-span-1 flex flex-col">
              <div
                className={`flex-1 rounded-xl shadow-sm border p-6 relative overflow-hidden flex flex-col
                ${
                  recommendation.type === 'CASH'
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30'
                    : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                }`}
              >
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                  <Target size={180} />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <div
                      className={`p-2 rounded-lg ${
                        recommendation.type === 'CASH'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                      }`}
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
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getTypeColor(
                            recommendation.type
                          )}`}
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
                              className={`text-[10px] uppercase font-bold w-fit px-1.5 py-0.5 rounded border ${getStatusColor(
                                asset.status
                              )}`}
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
                                className={`${
                                  asset.distMM200 >= 0
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-500'
                                } font-medium`}
                              >
                                MM200 {asset.distMM200 > 0 ? '+' : ''}
                                {asset.distMM200.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  isLocked ? 'bg-gray-400' : 'bg-indigo-500'
                                }`}
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
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col justify-center">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                  <TrendingDown size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-base">
                    Por que usar a MM200?
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Evitando "facas caindo".
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                Comprar "na baixa" pode ser desastroso se a tendência primária for de falência ou
                crise estrutural. A <strong>Média Móvel de 200 dias (MM200)</strong> age como um
                filtro de segurança:
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    <strong>Acima da MM200:</strong> Sinal Verde. O ativo está saudável e em
                    tendência de valorização.
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    <strong>Abaixo da MM200:</strong> Sinal Vermelho. Bloqueio automático para
                    evitar perdas profundas.
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col p-6">
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
                <p>Observe como a curva cresce exponencialmente.</p>
                <p className="font-bold text-red-600 dark:text-red-400 mt-1">
                  Perder 50% exige 100% de ganho apenas para empatar.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
