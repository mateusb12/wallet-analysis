import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart2,
  DollarSign,
  Percent,
  Clock,
  Activity,
  Calendar,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { getDetailedTimeElapsed, getTypeColor } from './contributionUtils.js';
import { fetchPriceClosestToDate } from '../../services/b3service.js';

export default function AssetPerformanceChart({ purchases }) {
  const [performanceMode, setPerformanceMode] = useState('relative');
  const [timeframe, setTimeframe] = useState(1);
  const [benchmarkData, setBenchmarkData] = useState({});
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);

  const [isPortfolioExpanded, setIsPortfolioExpanded] = useState(false);

  const uniqueAssetsInfo = useMemo(() => {
    if (!purchases || !purchases.length) return {};
    const assets = {};

    purchases.forEach((p) => {
      if (!assets[p.ticker]) {
        assets[p.ticker] = {
          currentPrice: p.currentPrice,
          firstTradeDate: p.trade_date,
        };
      }

      if (new Date(p.trade_date) < new Date(assets[p.ticker].firstTradeDate)) {
        assets[p.ticker].firstTradeDate = p.trade_date;
      }
    });
    return assets;
  }, [purchases]);

  useEffect(() => {
    const fetchBenchmarks = async () => {
      const assetKeys = Object.keys(uniqueAssetsInfo);
      if (assetKeys.length === 0) return;

      setLoadingBenchmark(true);
      const newBenchmarks = {};

      const now = new Date();
      const targetDate = new Date();
      targetDate.setFullYear(targetDate.getFullYear() - timeframe);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      await Promise.all(
        assetKeys.map(async (ticker) => {
          try {
            const { currentPrice, firstTradeDate } = uniqueAssetsInfo[ticker];

            let historicalPrice = await fetchPriceClosestToDate(ticker, targetDateStr);
            let usedDate = targetDate;
            let isPartial = false;

            if (!historicalPrice && firstTradeDate) {
              historicalPrice = await fetchPriceClosestToDate(ticker, firstTradeDate);
              usedDate = new Date(firstTradeDate);
              isPartial = true;
            }

            if (historicalPrice && currentPrice) {
              const diffTime = Math.abs(now - usedDate);
              const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);

              if (diffYears < 0.001) {
                newBenchmarks[ticker] = null;
                return;
              }

              let finalValue;
              let isSimpleReturn = false;

              if (diffYears < 1) {
                const totalReturn = (currentPrice - historicalPrice) / historicalPrice;
                finalValue = totalReturn * 100;
                isSimpleReturn = true;
              } else {
                const cagr = Math.pow(currentPrice / historicalPrice, 1 / diffYears) - 1;
                finalValue = cagr * 100;
              }

              newBenchmarks[ticker] = {
                value: finalValue,
                isPartial,
                isSimpleReturn,
                startDate: usedDate.toISOString().split('T')[0],
                years: diffYears,
              };
            } else {
              newBenchmarks[ticker] = null;
            }
          } catch (error) {
            console.error(`Erro ao calc benchmark para ${ticker}`, error);
            newBenchmarks[ticker] = null;
          }
        })
      );

      setBenchmarkData(newBenchmarks);
      setLoadingBenchmark(false);
    };

    fetchBenchmarks();
  }, [uniqueAssetsInfo, timeframe]);

  const assetPerformance = useMemo(() => {
    if (!purchases || !purchases.length) return [];

    const aggregation = {};
    purchases.forEach((item) => {
      if (!aggregation[item.ticker]) {
        aggregation[item.ticker] = {
          ticker: item.ticker,
          type: item.type,
          totalInvested: 0,
          totalProfit: 0,
          hasData: false,
          firstTradeDate: item.trade_date,
          benchmarkData: null,
        };
      }
      const cost = Number(item.price) * Number(item.qty);
      aggregation[item.ticker].totalInvested += cost;

      if (item.hasPriceData) {
        aggregation[item.ticker].totalProfit += item.profitValue;
        aggregation[item.ticker].hasData = true;
      }

      if (new Date(item.trade_date) < new Date(aggregation[item.ticker].firstTradeDate)) {
        aggregation[item.ticker].firstTradeDate = item.trade_date;
      }
    });

    return Object.values(aggregation)
      .filter((a) => a.hasData)
      .map((item) => {
        const totalYieldPercent =
          item.totalInvested > 0 ? (item.totalProfit / item.totalInvested) * 100 : 0;
        const timeData = getDetailedTimeElapsed(item.firstTradeDate);
        return {
          ...item,
          totalYieldPercent,
          timeData,
          benchmarkData: benchmarkData[item.ticker],
        };
      })
      .sort((a, b) =>
        performanceMode === 'relative'
          ? b.totalYieldPercent - a.totalYieldPercent
          : b.totalProfit - a.totalProfit
      );
  }, [purchases, performanceMode, benchmarkData]);

  const portfolioStats = useMemo(() => {
    if (!assetPerformance.length) return null;

    let totalInvested = 0;
    let totalProfit = 0;

    let weightedBenchmarkSum = 0;
    let totalWeightForBenchmark = 0;
    let hasPartialAssets = false;

    let oldestDate = new Date();

    assetPerformance.forEach((asset) => {
      totalInvested += asset.totalInvested;
      totalProfit += asset.totalProfit;

      if (new Date(asset.firstTradeDate) < oldestDate) {
        oldestDate = new Date(asset.firstTradeDate);
      }

      const currentAssetValue = asset.totalInvested + asset.totalProfit;
      const benchData = asset.benchmarkData;

      if (currentAssetValue > 0 && benchData && benchData.value !== null) {
        weightedBenchmarkSum += benchData.value * currentAssetValue;
        totalWeightForBenchmark += currentAssetValue;
        if (benchData.isPartial) hasPartialAssets = true;
      }
    });

    const totalYieldPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    const portfolioBenchmark =
      totalWeightForBenchmark > 0 ? weightedBenchmarkSum / totalWeightForBenchmark : null;

    return {
      ticker: 'CARTEIRA',
      type: 'TOTAL',
      totalProfit,
      totalYieldPercent,
      totalInvested,
      timeData: getDetailedTimeElapsed(oldestDate),
      benchmarkGrowth: portfolioBenchmark,
      hasPartialAssets,
    };
  }, [assetPerformance]);

  const contributionBreakdown = useMemo(() => {
    if (!portfolioStats || portfolioStats.benchmarkGrowth === null || !assetPerformance.length)
      return [];

    return assetPerformance
      .filter(
        (asset) => asset.benchmarkData?.value !== null && asset.benchmarkData?.value !== undefined
      )
      .map((asset) => {
        return {
          ...asset,
          rawReturn: asset.benchmarkData.value,
        };
      })
      .sort((a, b) => b.rawReturn - a.rawReturn);
  }, [assetPerformance, portfolioStats]);

  const maxValue = useMemo(() => {
    if (!assetPerformance.length) return 0;
    const assetsMax = Math.max(
      ...assetPerformance.map((a) =>
        Math.abs(performanceMode === 'relative' ? a.totalYieldPercent : a.totalProfit)
      )
    );
    if (portfolioStats) {
      const portfolioVal = Math.abs(
        performanceMode === 'relative'
          ? portfolioStats.totalYieldPercent
          : portfolioStats.totalProfit
      );
      return Math.max(assetsMax, portfolioVal);
    }
    return assetsMax;
  }, [assetPerformance, performanceMode, portfolioStats]);

  const renderBar = (item, isPortfolio = false, overrideValue = null, overrideMax = null) => {
    const displayValue =
      overrideValue !== null
        ? overrideValue
        : performanceMode === 'absolute'
          ? item.totalProfit
          : item.totalYieldPercent;

    const isProfit = displayValue >= 0;
    const calculationMax = overrideMax !== null ? overrideMax : maxValue;
    const rawPercentage = calculationMax > 0 ? Math.abs(displayValue) / calculationMax : 0;
    const widthPercentage = Math.max(1, rawPercentage * 100);

    let formattedValue;
    if (overrideValue !== null) {
      formattedValue = `${displayValue > 0 ? '+' : ''}${displayValue.toFixed(2)}%`;
    } else {
      formattedValue =
        performanceMode === 'absolute'
          ? displayValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : `${displayValue > 0 ? '+' : ''}${displayValue.toFixed(2)}%`;
    }

    return (
      <div
        className={`flex-1 h-9 rounded-lg relative flex items-center ${isPortfolio ? 'bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900 shadow-sm' : 'bg-gray-50 dark:bg-gray-700/50'}`}
      >
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out rounded-r-lg ${
              isProfit
                ? isPortfolio
                  ? 'bg-indigo-500/20 border-r-4 border-indigo-500'
                  : 'bg-green-500/20 border-r-4 border-green-500'
                : 'bg-red-500/20 border-r-4 border-red-500'
            }`}
            style={{ width: `${widthPercentage}%` }}
          />
        </div>

        <div className="absolute inset-0 flex items-center pl-3 pointer-events-none">
          <span
            className={`font-medium z-10 ${
              isProfit
                ? isPortfolio
                  ? 'text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}
          >
            {formattedValue}
          </span>
          {overrideValue !== null && (
            <span className="ml-2 text-[10px] text-gray-400 font-normal uppercase tracking-wider opacity-60">
              pts
            </span>
          )}
        </div>
      </div>
    );
  };

  if (assetPerformance.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-all">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Performance por Ativo</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <div className="px-2 text-gray-400 dark:text-gray-400">
              <Calendar size={14} />
            </div>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(Number(e.target.value))}
              className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer py-1 pr-2"
            >
              <option value={1}>1 Ano (12m)</option>
              <option value={2}>2 Anos (Média a.a.)</option>
              <option value={3}>3 Anos (Média a.a.)</option>
              <option value={4}>4 Anos (Média a.a.)</option>
              <option value={5}>5 Anos (Média a.a.)</option>
            </select>
          </div>

          <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              onClick={() => setPerformanceMode('relative')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${performanceMode === 'relative' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <Percent className="w-4 h-4" /> Retorno (%)
            </button>
            <button
              onClick={() => setPerformanceMode('absolute')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${performanceMode === 'absolute' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <DollarSign className="w-4 h-4" /> Valor (R$)
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {}
        {assetPerformance.map((asset, index) => {
          const benchData = asset.benchmarkData;
          const hasBenchmark = benchData && benchData.value !== null;
          const benchmarkVal = benchData?.value || 0;
          const isPartial = benchData?.isPartial;
          const isSimpleReturn = benchData?.isSimpleReturn;

          return (
            <div key={asset.ticker} className="flex items-center gap-4 text-sm group">
              <div className="w-6 text-gray-400 font-mono text-xs">#{index + 1}</div>

              <div className="w-24 flex-shrink-0">
                <div className="font-bold text-gray-800 dark:text-gray-200">{asset.ticker}</div>
                <div
                  className={`text-[10px] uppercase font-bold w-fit px-1.5 rounded ${getTypeColor(asset.type)}`}
                >
                  {asset.type}
                </div>
              </div>

              <div className="w-24 text-right hidden sm:flex flex-col items-end mr-2 border-r border-gray-100 dark:border-gray-700 pr-4">
                <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                  <Clock className="w-3 h-3" /> Tempo
                </div>
                <div className="font-mono font-bold text-gray-600 dark:text-gray-300">
                  {asset.timeData.short}
                </div>
              </div>

              <div className="flex-1 relative group/bench">
                {renderBar(asset)}

                {}
                <div
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-end justify-center cursor-help z-20"
                  title={
                    hasBenchmark
                      ? isSimpleReturn
                        ? `Retorno total absoluto do período (${benchData.startDate} até hoje). Não anualizado pois o histórico é curto.`
                        : isPartial
                          ? `Histórico parcial. CAGR calculado desde ${benchData.startDate} (${benchData.years.toFixed(1)} anos).`
                          : `Rentabilidade anualizada média do ativo nos últimos ${timeframe} anos: ${benchmarkVal.toFixed(2)}%`
                      : 'Dados históricos insuficientes.'
                  }
                >
                  {loadingBenchmark ? (
                    <span className="text-[10px] text-gray-400 animate-pulse">Calc...</span>
                  ) : hasBenchmark ? (
                    <>
                      <div className="flex items-center gap-1 opacity-60 group-hover/bench:opacity-100 transition-opacity">
                        <Activity className="w-3 h-3 text-gray-400" />
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold">
                          {isSimpleReturn
                            ? 'Absoluto'
                            : isPartial
                              ? `CAGR (${benchData.years.toFixed(1)}Y)`
                              : `Mkt ${timeframe === 1 ? '12m' : `${timeframe}Y (a.a.)`}`}
                        </span>
                        {(isPartial || isSimpleReturn) && (
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold ${benchmarkVal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                      >
                        {benchmarkVal > 0 ? '+' : ''}
                        {benchmarkVal.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 opacity-70 group-hover/bench:opacity-100 transition-opacity">
                      <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                        S/ Histórico
                      </span>
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {}
        {portfolioStats && (
          <>
            <div className="my-4 border-t border-gray-200 dark:border-gray-700 border-dashed" />

            <div className="flex flex-col rounded-lg bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 overflow-visible transition-all duration-300">
              <div
                onClick={() => setIsPortfolioExpanded(!isPortfolioExpanded)}
                className="flex items-center gap-4 text-sm group p-2 cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <div className="w-6 text-indigo-400 flex justify-center">
                  {isPortfolioExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                <div className="w-24 flex-shrink-0">
                  <div className="font-black text-indigo-900 dark:text-indigo-100 tracking-tight">
                    CARTEIRA
                  </div>
                  <div className="text-[10px] uppercase font-bold w-fit px-1.5 rounded bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200">
                    GERAL
                  </div>
                </div>

                <div className="w-24 text-right hidden sm:flex flex-col items-end mr-2 border-r border-indigo-200 dark:border-indigo-800/50 pr-4">
                  <div className="flex items-center gap-1 text-[10px] text-indigo-400 uppercase tracking-wide mb-0.5">
                    <Clock className="w-3 h-3" /> Início
                  </div>
                  <div className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    {portfolioStats.timeData.short}
                  </div>
                </div>

                <div className="flex-1 relative group/bench">
                  {renderBar(portfolioStats, true)}

                  <div
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-end justify-center cursor-help z-20"
                    title={
                      loadingBenchmark
                        ? ''
                        : portfolioStats.benchmarkGrowth !== null
                          ? `Média Ponderada da performance histórica. ${portfolioStats.hasPartialAssets ? 'Alguns ativos possuem histórico parcial (Retorno Absoluto ou CAGR ajustado).' : ''}`
                          : 'Dados insuficientes para calcular média ponderada.'
                    }
                  >
                    {loadingBenchmark ? (
                      <span className="text-[10px] text-indigo-400 animate-pulse">Calc...</span>
                    ) : portfolioStats.benchmarkGrowth !== null ? (
                      <>
                        <div className="flex items-center gap-1 opacity-60 group-hover/bench:opacity-100 transition-opacity">
                          <Activity className="w-3 h-3 text-indigo-400" />
                          <span className="text-[9px] text-indigo-500 dark:text-indigo-400 uppercase font-bold">
                            Média {timeframe === 1 ? '12m' : `${timeframe}Y`}
                          </span>
                          {portfolioStats.hasPartialAssets && (
                            <AlertTriangle className="w-3 h-3 text-indigo-400" />
                          )}
                        </div>
                        <span
                          className={`text-xs font-bold ${portfolioStats.benchmarkGrowth >= 0 ? 'text-indigo-600 dark:text-indigo-300' : 'text-indigo-400'}`}
                        >
                          {portfolioStats.benchmarkGrowth > 0 ? '+' : ''}
                          {portfolioStats.benchmarkGrowth.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 opacity-60">
                        <span className="text-[9px] font-bold text-indigo-300 uppercase">
                          S/ Dados
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {}
              {isPortfolioExpanded && (
                <div className="px-4 py-3 bg-white/50 dark:bg-gray-800/30 border-t border-indigo-100 dark:border-indigo-800/30 animate-in slide-in-from-top-2 duration-200">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" />
                      Ranking de Eficiência Histórica
                    </h4>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 text-right">
                      Comparativo de performance pura (independente do peso na carteira)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {contributionBreakdown.map((asset) => {
                      const maxRawReturn = Math.max(
                        ...contributionBreakdown.map((a) => Math.abs(a.rawReturn)),
                        Math.abs(portfolioStats.benchmarkGrowth || 0)
                      );

                      const isPartial = asset.benchmarkData?.isPartial;
                      const isSimple = asset.benchmarkData?.isSimpleReturn;
                      const isAboveAverage =
                        asset.rawReturn > (portfolioStats.benchmarkGrowth || 0);

                      return (
                        <div key={asset.ticker} className="flex items-center gap-3 text-xs">
                          <div className="w-24 font-semibold text-gray-600 dark:text-gray-300 flex flex-col">
                            <span className="flex items-center gap-1">
                              <ArrowRight
                                size={10}
                                className={isAboveAverage ? 'text-green-500' : 'text-gray-300'}
                              />
                              {asset.ticker}
                            </span>
                            <span
                              className="text-[9px] text-gray-400 pl-3 font-normal opacity-75 flex items-center gap-1 cursor-help hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                              title={
                                isSimple
                                  ? 'Retorno Absoluto (histórico curto)'
                                  : isPartial
                                    ? `CAGR Ajustado (${asset.benchmarkData?.years.toFixed(1)} anos)`
                                    : `CAGR de Mercado (${timeframe} anos)`
                              }
                            >
                              {isSimple ? 'Abs' : 'Mkt'}: {asset.benchmarkData?.value?.toFixed(1)}%
                              {(isPartial || isSimple) && (
                                <AlertTriangle size={8} className="text-amber-500" />
                              )}
                            </span>
                          </div>
                          <div className="flex-1 relative">
                            {}
                            {renderBar(asset, false, asset.rawReturn, maxRawReturn)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50 text-[10px] text-center text-gray-400 italic">
                    Ordenado pela rentabilidade do ativo. Use isso para identificar quais ativos
                    historicamente perfomaram melhor.
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
