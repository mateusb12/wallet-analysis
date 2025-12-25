import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Target,
  AlertTriangle,
  Lock,
  CheckCircle2,
  BarChart2,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  StrategySimulator,
  DrawdownAnalysis,
  CagrSimulator,
  VolatilityImpact,
} from './FinancialEducationCharts';
import RiskDisclaimer from './RiskDisclaimer.jsx';

const MOCK_MARKET_DATA = [
  { ticker: 'QQQQ11', type: 'ETF', price: 112.46, mm200: 98.2, cagr: 21.5, sharpe: 1.2 },
  { ticker: 'IVVB11', type: 'ETF', price: 280.0, mm200: 295.5, cagr: 18.2, sharpe: 0.4 },
  { ticker: 'BTLG11', type: 'FII', price: 102.11, mm200: 100.5, cagr: 12.8, sharpe: 0.9 },
  { ticker: 'WEGE3', type: 'STOCK', price: 43.85, mm200: 38.0, cagr: 15.4, sharpe: 1.1 },
];

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

export default function WhereToInvest() {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState([]);
  const [recommendation, setRecommendation] = useState(null);

  const [selectedTicker, setSelectedTicker] = useState(null);

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

  const handleSelectAsset = (ticker) => setSelectedTicker(ticker);
  const handleDeselectAsset = (e) => {
    e.stopPropagation();
    setSelectedTicker(null);
  };

  const selectedAssetData = useMemo(() => {
    return analysis.find((a) => a.ticker === selectedTicker) || null;
  }, [analysis, selectedTicker]);

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
                    const isSelected = selectedTicker === asset.ticker;
                    const widthPercentage = (asset.cagr / maxCagr) * 100;

                    return (
                      <div
                        key={asset.ticker}
                        onClick={() => handleSelectAsset(asset.ticker)}
                        className={`
                          relative group rounded-lg p-2 transition-all cursor-pointer border
                          ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20 dark:border-indigo-500'
                              : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/30'
                          }
                          ${isLocked ? 'opacity-60 grayscale-[0.8]' : ''}
                        `}
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
                          {isSelected && (
                            <button
                              onClick={handleDeselectAsset}
                              className="absolute right-2 top-2 p-1 rounded-full bg-white dark:bg-gray-800 text-gray-500 hover:text-red-500 hover:bg-red-50 shadow-sm border border-gray-200 dark:border-gray-600 transition-colors"
                              title="Remover seleção"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {}
          <div className="grid md:grid-cols-2 gap-6 pt-4">
            <StrategySimulator asset={selectedAssetData} />
            <CagrSimulator asset={selectedAssetData} />
            <DrawdownAnalysis />
            <VolatilityImpact />
          </div>

          <RiskDisclaimer />
        </>
      )}
    </div>
  );
}
