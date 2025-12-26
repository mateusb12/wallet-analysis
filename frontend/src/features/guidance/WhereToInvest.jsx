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
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  StrategySimulator,
  DrawdownAnalysis,
  CagrSimulator,
  VolatilityImpact,
  AsymmetryExplanation,
  CagrExplanation,
} from './FinancialEducationCharts';
import RiskDisclaimer from './RiskDisclaimer.jsx';
import Pagination from '../../components/Pagination';
import { analysisService } from '../../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';
import iconTotal from '../../assets/all.png';

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
    label: 'Bom equilíbrio risco/retorno',
    description: 'Crescimento consistente com volatilidade controlada.',
    color: 'green',
  },
  {
    min: 1.2,
    max: 2.0,
    label: 'Retorno eficiente',
    description: 'Excelente relação entre retorno e risco. Ativo sustentável para longo prazo.',
    color: 'blue',
  },
  {
    min: 2.0,
    max: 999,
    label: 'Excepcional (raro)',
    description: 'Retorno muito alto para o risco assumido. Geralmente temporário.',
    color: 'purple',
  },
];

const getColorClasses = (color) => {
  const map = {
    red: { border: 'border-red-500', text: 'text-red-400', dotted: 'border-red-500/50' },
    orange: {
      border: 'border-orange-500',
      text: 'text-orange-400',
      dotted: 'border-orange-500/50',
    },
    yellow: {
      border: 'border-yellow-500',
      text: 'text-yellow-400',
      dotted: 'border-yellow-500/50',
    },
    green: {
      border: 'border-emerald-500',
      text: 'text-emerald-400',
      dotted: 'border-emerald-500/50',
    },
    blue: { border: 'border-blue-500', text: 'text-blue-400', dotted: 'border-blue-500/50' },
    purple: {
      border: 'border-purple-500',
      text: 'text-purple-400',
      dotted: 'border-purple-500/50',
    },
  };
  return map[color] || map.red;
};

const SharpeLegend = () => (
  <div className="relative group flex items-center gap-1.5 cursor-help w-fit">
    <span className="text-sm text-gray-500 dark:text-gray-400 border-b border-dashed border-gray-300 dark:border-gray-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
      Sharpe (Risco)
    </span>
    <Info size={14} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
    <div className="absolute bottom-full left-0 mb-3 w-64 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-[60] pointer-events-none">
      <div className="relative p-3 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 border-b border-gray-100 dark:border-gray-800 pb-2">
          Escala de Classificação
        </h4>
        <div className="space-y-2">
          {SHARPE_RANGES.map((range, index) => {
            const styles = getColorClasses(range.color);
            const rangeText =
              range.min === -999
                ? '< 0'
                : range.max === 999
                  ? '> 2.0'
                  : `${range.min} - ${range.max}`;
            return (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className={`font-mono font-bold ${styles.text}`}>{rangeText}</span>
                <span className="text-gray-600 dark:text-gray-400 text-right font-medium truncate ml-2">
                  {range.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute -bottom-2 left-6 w-4 h-4 rotate-45 border-b border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"></div>
      </div>
    </div>
  </div>
);

const SharpeTooltip = ({ value }) => {
  const info = SHARPE_RANGES.find((r) => value >= r.min && value < r.max) || SHARPE_RANGES[0];
  const styles = getColorClasses(info.color);

  return (
    <div className="relative group flex items-center justify-end">
      <span
        className={`text-xl font-bold border-b-2 border-dotted cursor-help transition-colors ${styles.dotted} hover:${styles.border} text-gray-900 dark:text-white`}
      >
        {value}
      </span>
      <div className="absolute bottom-full mb-3 right-0 w-64 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-[60] pointer-events-none">
        <div
          className={`relative p-4 rounded-xl shadow-2xl border-2 bg-white dark:bg-gray-900 ${styles.border}`}
        >
          <h4 className={`font-bold text-sm mb-1 uppercase tracking-wide ${styles.text}`}>
            {info.label}
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
            {info.description}
          </p>
          <div
            className={`absolute -bottom-2 right-4 w-4 h-4 rotate-45 border-b-2 border-r-2 bg-white dark:bg-gray-900 ${styles.border}`}
          ></div>
        </div>
      </div>
    </div>
  );
};

const getAssetIcon = (type) => {
  if (!type) return iconTotal;
  switch (type.toUpperCase()) {
    case 'STOCK':
      return iconStocks;
    case 'FII':
      return iconFiis;
    case 'ETF':
      return iconEtf;
    default:
      return iconTotal;
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
    case 'DADOS INSUFICIENTES':
      return 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function WhereToInvest() {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const initData = async () => {
      try {
        setLoading(true);

        const rawData = await analysisService.getOpportunities();

        const processed = rawData.map((asset) => {
          if (asset.tag === 'INCOMPLETE') {
            return {
              ...asset,
              momentum: false,
              distMM200: 0,
              status: 'DADOS INSUFICIENTES',
            };
          }

          const momentum = asset.price > asset.mm200;
          const distMM200 = ((asset.price - asset.mm200) / asset.mm200) * 100;
          let status = momentum ? 'ELEGÍVEL' : 'BLOQUEADO';
          return { ...asset, momentum, distMM200, status };
        });

        const ranked = processed.sort((a, b) => {
          if (a.status === 'DADOS INSUFICIENTES') return 1;
          if (b.status === 'DADOS INSUFICIENTES') return -1;
          return b.cagr - a.cagr;
        });

        let foundLeader = false;
        const finalRanked = ranked.map((asset) => {
          if (asset.status === 'DADOS INSUFICIENTES') return asset;
          if (!asset.momentum) return { ...asset, status: 'BLOQUEADO' };

          if (!foundLeader) {
            foundLeader = true;
            return { ...asset, status: 'LÍDER' };
          }
          return { ...asset, status: 'SECUNDÁRIO' };
        });

        setAnalysis(finalRanked);

        const leader = finalRanked.find((a) => a.status === 'LÍDER');

        if (finalRanked.length === 0) {
          setRecommendation(null);
        } else {
          setRecommendation(leader || { type: 'CASH', ticker: 'CAIXA' });
        }
      } catch (error) {
        console.error('Failed to fetch market data', error);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [user?.id]);

  const maxCagr = useMemo(() => Math.max(...analysis.map((a) => a.cagr), 0), [analysis]);

  const handleSelectAsset = (ticker) => setSelectedTicker(ticker);
  const handleDeselectAsset = (e) => {
    e.stopPropagation();
    setSelectedTicker(null);
  };

  const selectedAssetData = useMemo(() => {
    return analysis.find((a) => a.ticker === selectedTicker) || null;
  }, [analysis, selectedTicker]);

  const displayedAsset = selectedAssetData || recommendation;
  const cardTitle = selectedAssetData ? 'Análise do Selecionado' : 'Ação Recomendada';

  const totalPages = Math.ceil(analysis.length / ITEMS_PER_PAGE);

  const currentData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return analysis.slice(start, start + ITEMS_PER_PAGE);
  }, [analysis, currentPage]);

  const getProgressBarColor = (value) => {
    if (value < 0) return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]';
    if (value < 8) return 'bg-slate-500 dark:bg-slate-600';
    if (value < 15) return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
    return 'bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)]';
  };

  const getMM200Color = (value) => {
    if (value < 0) return 'text-red-500 dark:text-red-400';
    if (value < 5) return 'text-emerald-500 dark:text-emerald-400 font-bold';
    if (value < 15) return 'text-sky-500 dark:text-sky-400 font-bold';
    return 'text-violet-500 dark:text-violet-400 font-bold';
  };

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
      ) : !displayedAsset ? (
        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="mx-auto w-16 h-16 bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Dados Insuficientes
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
            Não foi possível calcular recomendações. Verifique se você possui ativos cadastrados e
            se a sincronização de preços foi realizada.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 py-2 px-4 rounded-lg w-fit mx-auto">
            <RefreshCw size={16} />
            Dica: Vá em "Configurações &gt; Sincronização Manual"
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 flex flex-col">
              <div
                className={`flex-1 rounded-xl shadow-sm border p-6 relative overflow-hidden flex flex-col 
                  ${
                    displayedAsset.type === 'CASH'
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
                      className={`p-2 rounded-lg 
                        ${
                          displayedAsset.type === 'CASH' || !displayedAsset.momentum
                            ? 'bg-red-100 text-red-600'
                            : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                        }`}
                    >
                      {displayedAsset.type === 'CASH' || !displayedAsset.momentum ? (
                        <AlertTriangle size={24} />
                      ) : (
                        <CheckCircle2 size={24} />
                      )}
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {cardTitle}
                    </span>
                  </div>

                  {displayedAsset.type === 'CASH' ? (
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
                      {}
                      <div className="flex items-center gap-3 mb-2">
                        <img
                          src={getAssetIcon(displayedAsset.type)}
                          alt={displayedAsset.type}
                          className="w-14 h-14 object-contain p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600"
                        />
                        <div>
                          <h3 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">
                            {displayedAsset.ticker}
                          </h3>
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getTypeColor(displayedAsset.type)}`}
                          >
                            {displayedAsset.type}
                          </span>
                        </div>
                      </div>
                      {}

                      {displayedAsset.momentum ? (
                        <p className="text-green-600 dark:text-green-400 font-medium text-sm mb-8 flex items-center gap-1">
                          <TrendingUp size={16} /> Tendência de Alta Confirmada
                        </p>
                      ) : (
                        <p className="text-red-500 dark:text-red-400 font-medium text-sm mb-8 flex items-center gap-1">
                          <Lock size={16} /> Tendência de Baixa (Abaixo MM200)
                        </p>
                      )}

                      <div className="space-y-5">
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700/50 pb-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Potencial (CAGR)
                          </span>
                          <span className="text-xl font-bold text-gray-900 dark:text-white">
                            {displayedAsset.cagr}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700/50 pb-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Distância MM200
                          </span>
                          <span
                            className={`text-xl font-bold ${displayedAsset.distMM200 >= 0 ? 'text-green-600' : 'text-red-500'}`}
                          >
                            {displayedAsset.distMM200 > 0 ? '+' : ''}
                            {displayedAsset.distMM200.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700/50 pb-3">
                          <SharpeLegend />
                          <SharpeTooltip value={displayedAsset.sharpe} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-8">
                  <button
                    disabled={!displayedAsset.momentum && displayedAsset.type !== 'CASH'}
                    className={`w-full py-3 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]
                      ${
                        !displayedAsset.momentum && displayedAsset.type !== 'CASH'
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none dark:bg-gray-700 dark:text-gray-400'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                      }`}
                  >
                    {!displayedAsset.momentum && displayedAsset.type !== 'CASH' ? (
                      <>
                        <Lock size={18} /> Aporte Bloqueado
                      </>
                    ) : (
                      <>
                        Registrar Aporte <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col justify-between">
                <div>
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
                    {currentData.map((asset, index) => {
                      const isLocked = asset.status === 'BLOQUEADO';
                      const isDataError = asset.status === 'DADOS INSUFICIENTES';
                      const isSelected = selectedTicker === asset.ticker;
                      const widthPercentage = (asset.cagr / maxCagr) * 100;
                      const globalRank = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;

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
                          ${isLocked || isDataError ? 'opacity-70' : ''}
                        `}
                        >
                          <div className="flex items-center gap-4 text-sm mb-2">
                            <div className="w-6 text-gray-400 font-mono text-sm font-bold">
                              #{globalRank}
                            </div>

                            {}
                            <div className="flex-shrink-0">
                              <img
                                src={getAssetIcon(asset.type)}
                                alt={asset.type}
                                className="w-9 h-9 object-contain p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg"
                              />
                            </div>
                            {}

                            <div className="w-24 flex-shrink-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-lg text-gray-800 dark:text-gray-200">
                                  {asset.ticker}
                                </span>
                                {isLocked && <Lock size={12} className="text-red-400" />}
                                {isDataError && (
                                  <AlertTriangle size={12} className="text-orange-400" />
                                )}
                              </div>
                              <div
                                className={`text-[9px] uppercase font-bold w-fit px-1.5 py-0.5 rounded border truncate max-w-full ${getStatusColor(asset.status)}`}
                              >
                                {asset.status}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between mb-1.5 text-xs">
                                <span className="font-medium text-gray-500 dark:text-gray-400">
                                  CAGR {asset.cagr}%
                                </span>
                                <span className={`${getMM200Color(asset.distMM200)} font-bold`}>
                                  MM200 {asset.distMM200 > 0 ? '+' : ''}
                                  {asset.distMM200.toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-1000 ${
                                    isLocked || isDataError
                                      ? 'bg-gray-300 dark:bg-gray-600'
                                      : getProgressBarColor(asset.cagr)
                                  }`}
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

                {analysis.length > ITEMS_PER_PAGE && (
                  <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-4">
            <StrategySimulator asset={selectedAssetData} />
            <CagrSimulator asset={selectedAssetData} />
            <DrawdownAnalysis />
            <VolatilityImpact />
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-4">
            <AsymmetryExplanation />
            <CagrExplanation />
          </div>

          <RiskDisclaimer />
        </>
      )}
    </div>
  );
}
