import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart2,
  DollarSign,
  Percent,
  Clock,
  Activity,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { getDetailedTimeElapsed, getTypeColor } from './contributionUtils.js';
import { fetchPriceClosestToDate } from '../../services/b3service.js';

export default function AssetPerformanceChart({ purchases }) {
  const [performanceMode, setPerformanceMode] = useState('relative');
  const [timeframe, setTimeframe] = useState(1);
  const [benchmarkData, setBenchmarkData] = useState({});
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);

  const uniqueAssets = useMemo(() => {
    if (!purchases || !purchases.length) return {};
    const assets = {};
    purchases.forEach((p) => {
      if (!assets[p.ticker] && p.currentPrice) {
        assets[p.ticker] = p.currentPrice;
      }
    });
    return assets;
  }, [purchases]);

  useEffect(() => {
    const fetchBenchmarks = async () => {
      if (Object.keys(uniqueAssets).length === 0) return;

      setLoadingBenchmark(true);
      const newBenchmarks = {};

      const targetDate = new Date();
      targetDate.setFullYear(targetDate.getFullYear() - timeframe);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      await Promise.all(
        Object.keys(uniqueAssets).map(async (ticker) => {
          try {
            const currentPrice = uniqueAssets[ticker];
            const historicalPrice = await fetchPriceClosestToDate(ticker, targetDateStr);

            if (historicalPrice && currentPrice) {
              const totalReturn = (currentPrice - historicalPrice) / historicalPrice;
              let annualizedReturn;

              if (timeframe === 1) {
                annualizedReturn = totalReturn * 100;
              } else {
                const cagr = Math.pow(currentPrice / historicalPrice, 1 / timeframe) - 1;
                annualizedReturn = cagr * 100;
              }

              newBenchmarks[ticker] = annualizedReturn;
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
  }, [uniqueAssets, timeframe]);

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
          benchmarkGrowth: 0,
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
          benchmarkGrowth: benchmarkData[item.ticker],
        };
      })
      .sort((a, b) =>
        performanceMode === 'relative'
          ? b.totalYieldPercent - a.totalYieldPercent
          : b.totalProfit - a.totalProfit
      );
  }, [purchases, performanceMode, benchmarkData]);

  const maxValue = useMemo(() => {
    if (!assetPerformance.length) return 0;
    return Math.max(
      ...assetPerformance.map((a) =>
        Math.abs(performanceMode === 'relative' ? a.totalYieldPercent : a.totalProfit)
      )
    );
  }, [assetPerformance, performanceMode]);

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
        {assetPerformance.map((asset, index) => {
          const displayValue =
            performanceMode === 'absolute' ? asset.totalProfit : asset.totalYieldPercent;
          const isProfit = displayValue >= 0;
          const rawPercentage = maxValue > 0 ? Math.abs(displayValue) / maxValue : 0;
          const widthPercentage = Math.max(1, rawPercentage * 100);
          const formattedValue =
            performanceMode === 'absolute'
              ? displayValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : `${displayValue > 0 ? '+' : ''}${displayValue.toFixed(2)}%`;

          const hasBenchmark =
            asset.benchmarkGrowth !== null && asset.benchmarkGrowth !== undefined;
          const benchmarkVal = asset.benchmarkGrowth || 0;

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

              <div className="flex-1 h-9 bg-gray-50 dark:bg-gray-700/50 rounded-lg relative overflow-hidden flex items-center">
                <div
                  className={`h-full transition-all duration-500 ease-out rounded-r-lg ${isProfit ? 'bg-green-500/20 border-r-4 border-green-500' : 'bg-red-500/20 border-r-4 border-red-500'}`}
                  style={{ width: `${widthPercentage}%` }}
                />

                <div className="absolute inset-0 flex items-center pl-3">
                  <span
                    className={`font-medium ${isProfit ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}
                  >
                    {formattedValue}
                  </span>
                </div>

                <div className="absolute right-3 flex flex-col items-end justify-center cursor-help group/bench z-10">
                  {loadingBenchmark ? (
                    <span className="text-[10px] text-gray-400 animate-pulse">Calc...</span>
                  ) : hasBenchmark ? (
                    <>
                      <div className="flex items-center gap-1 opacity-60 group-hover/bench:opacity-100 transition-opacity">
                        <Activity className="w-3 h-3 text-gray-400" />
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold">
                          Mkt {timeframe === 1 ? '12m' : `${timeframe}Y (a.a.)`}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-bold ${benchmarkVal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                        title={`Rentabilidade anualizada média do ativo nos últimos ${timeframe} anos: ${benchmarkVal.toFixed(2)}%`}
                      >
                        {benchmarkVal > 0 ? '+' : ''}
                        {benchmarkVal.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 opacity-70 group-hover/bench:opacity-100 transition-opacity"
                      title={`Dados históricos insuficientes. O ativo pode não existir há ${timeframe} anos ou os dados ainda não foram importados.`}
                    >
                      <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                        Sem Histórico
                      </span>
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
