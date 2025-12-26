import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Layers, ArrowRight } from 'lucide-react';

const FormatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const FormatPercent = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1 }).format(
    value / 100
  );

const DriftIndicator = ({ label, currentPct, targetPct, amount, compact = false }) => {
  const diff = currentPct - targetPct;
  const isUnderweight = diff < -1;
  const isOverweight = diff > 1;

  let statusColor = 'text-emerald-600 dark:text-emerald-400';
  let barColor = 'bg-emerald-500';
  let statusText = 'No Alvo';
  let bgBadge =
    'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';

  if (isUnderweight) {
    statusColor = 'text-amber-600 dark:text-amber-400';
    barColor = 'bg-amber-500';
    statusText = 'Abaixo';
    bgBadge = 'bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20';
  } else if (isOverweight) {
    statusColor = 'text-rose-600 dark:text-rose-400';
    barColor = 'bg-rose-500';
    statusText = 'Acima';
    bgBadge = 'bg-rose-100 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20';
  }

  return (
    <div className="w-full">
      {}
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
          )}
          <div className="flex gap-2 mt-0.5">
            <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider">
              Meta {targetPct.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
          <div
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${bgBadge} ${statusColor} mb-1 shadow-sm`}
          >
            {statusText}
          </div>
        </div>
      </div>

      {}
      <div
        className={`relative w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-2.5'}`}
      >
        {}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-900 dark:bg-white z-20 opacity-40"
          style={{ left: `${Math.min(targetPct, 100)}%` }}
        />
        {}
        <div
          className={`absolute top-0 bottom-0 left-0 ${barColor} transition-all duration-700 ease-out rounded-full shadow-sm`}
          style={{ width: `${Math.min(currentPct, 100)}%` }}
        />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {currentPct.toFixed(1)}% carteira
        </span>
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
          {FormatCurrency(amount)}
        </span>
      </div>
    </div>
  );
};

const AssetListTable = ({ assets, totalValue }) => {
  return (
    <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 shadow-inner">
      <table className="w-full text-xs text-left">
        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-semibold border-b border-gray-100 dark:border-gray-700">
          <tr>
            <th className="px-4 py-3">Ativo</th>
            <th className="px-4 py-3 text-right">Qtd</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3 text-center w-28">Peso Relativo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {assets.map((asset) => {
            const assetValue = asset.qty * asset.price;
            const assetWeight = (assetValue / totalValue) * 100;

            return (
              <tr
                key={asset.ticker}
                className="group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-200 cursor-default"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-500 transition-colors"></div>
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {asset.ticker}
                      </span>
                      <span className="block text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">
                        {asset.sector}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 font-mono">
                  {asset.qty}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-gray-200 font-mono group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {FormatCurrency(assetValue)}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col gap-1 items-end w-full">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-400 dark:bg-blue-500 h-full rounded-full"
                        style={{ width: `${assetWeight}%` }}
                      ></div>
                    </div>
                    <span className="text-[9px] text-gray-400 font-mono">
                      {assetWeight.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const HierarchyDrillDown = ({ portfolioTree, targets }) => {
  const [expanded, setExpanded] = useState({ fii: true, stock: true });
  const [expandedSub, setExpandedSub] = useState({});

  const toggleExpand = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSubExpand = (e, uniqueKey) => {
    e.stopPropagation();
    setExpandedSub((prev) => ({ ...prev, [uniqueKey]: !prev[uniqueKey] }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-inner">
          <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Raio-X de Alocação</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Visualize a profundidade da sua carteira
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {}
        {Object.entries(portfolioTree).map(([assetClass, data]) => {
          const target = targets.macro[assetClass] || 0;
          const currentPct = data.percentOfTotal;
          const isExpanded = expanded[assetClass];

          return (
            <div
              key={assetClass}
              className={`
                relative rounded-2xl transition-all duration-300 ease-out border
                ${
                  isExpanded
                    ? 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-900 shadow-lg ring-1 ring-blue-500/10 scale-[1.01]'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:-translate-y-1 hover:shadow-md'
                }
              `}
            >
              {}
              <div className="p-5 cursor-pointer group" onClick={() => toggleExpand(assetClass)}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {}
                    <div
                      className={`
                        w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300
                        ${
                          isExpanded
                            ? 'bg-blue-600 text-white shadow-blue-500/30 shadow-md'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                        }
                      `}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                        {assetClass}
                      </h4>
                      {!isExpanded && (
                        <span className="text-xs text-gray-400 animate-in fade-in">
                          Clique para expandir
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                      {FormatPercent(currentPct)}
                    </span>
                  </div>
                </div>

                <DriftIndicator
                  label=""
                  currentPct={currentPct}
                  targetPct={target}
                  amount={data.totalValue}
                />
              </div>

              {}
              {isExpanded && data.subTypes && (
                <div className="bg-gray-50/80 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700 p-4 sm:p-6 space-y-3 rounded-b-2xl">
                  {Object.entries(data.subTypes).map(([subType, subData]) => {
                    const uniqueKey = `${assetClass}-${subType}`;
                    const isSubExpanded = expandedSub[uniqueKey];

                    let subTarget = 0;
                    if (assetClass === 'fii') subTarget = 60;
                    if (subType === 'Papel') subTarget = 40;

                    const relativePercent = (subData.value / data.totalValue) * 100;

                    return (
                      <div
                        key={subType}
                        onClick={(e) => toggleSubExpand(e, uniqueKey)}
                        className={`
                                group/sub relative bg-white dark:bg-gray-800 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden
                                ${
                                  isSubExpanded
                                    ? 'border-blue-300 dark:border-blue-600 shadow-md'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-sm'
                                }
                            `}
                      >
                        {}
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-200 ${isSubExpanded ? 'bg-blue-500' : 'bg-transparent group-hover/sub:bg-blue-300'}`}
                        ></div>

                        <div className="p-4 pl-5 transition-all duration-200 group-hover/sub:pl-6">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold text-base transition-colors ${isSubExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200 group-hover/sub:text-blue-600'}`}
                              >
                                {subType}
                              </span>
                              {isSubExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-500" />
                              ) : (
                                <ArrowRight className="w-4 h-4 text-gray-300 group-hover/sub:text-blue-400 group-hover/sub:translate-x-1 transition-all" />
                              )}
                            </div>
                          </div>

                          <DriftIndicator
                            label=""
                            currentPct={relativePercent}
                            targetPct={subTarget}
                            amount={subData.value}
                            compact={true}
                          />
                        </div>

                        {}
                        {isSubExpanded && subData.assets && (
                          <div className="px-4 pb-4 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700 pt-2 animate-in slide-in-from-top-2">
                            <AssetListTable assets={subData.assets} totalValue={subData.value} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HierarchyDrillDown;
