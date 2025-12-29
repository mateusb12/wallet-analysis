import React, { useState, useMemo } from 'react';
import { BarChart2, DollarSign, Percent, Clock, Activity } from 'lucide-react';

import { getDetailedTimeElapsed, getTypeColor } from '../../utils/contributionUtils';

export default function AssetPerformanceChart({ purchases }) {
  const [performanceMode, setPerformanceMode] = useState('relative');

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
          asset1YGrowth: item.asset1YGrowth,
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
        return { ...item, totalYieldPercent, timeData };
      })
      .sort((a, b) =>
        performanceMode === 'relative'
          ? b.totalYieldPercent - a.totalYieldPercent
          : b.totalProfit - a.totalProfit
      );
  }, [purchases, performanceMode]);

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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            Performance por Ativo vs. Mercado (12m)
          </h3>
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

      <div className="space-y-4">
        {assetPerformance.map((asset, index) => {
          const displayValue =
            performanceMode === 'absolute' ? asset.totalProfit : asset.totalYieldPercent;
          const isProfit = displayValue >= 0;
          const rawPercentage = Math.abs(displayValue) / maxValue;
          const widthPercentage = Math.max(1, rawPercentage * 100);
          const formattedValue =
            performanceMode === 'absolute'
              ? displayValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : `${displayValue > 0 ? '+' : ''}${displayValue.toFixed(2)}%`;
          const hasBenchmark = asset.asset1YGrowth !== null && asset.asset1YGrowth !== undefined;

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
                {hasBenchmark && (
                  <div
                    className="absolute right-3 flex flex-col items-end justify-center cursor-help group/bench"
                    title={`O ativo ${asset.ticker} acumulou ${asset.asset1YGrowth.toFixed(2)}% de alta nos últimos 12 meses.`}
                  >
                    <div className="flex items-center gap-1 opacity-60 group-hover/bench:opacity-100 transition-opacity">
                      <Activity className="w-3 h-3 text-gray-400" />
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold">
                        Mkt 12m
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold ${asset.asset1YGrowth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                    >
                      {asset.asset1YGrowth > 0 ? '+' : ''}
                      {asset.asset1YGrowth.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
