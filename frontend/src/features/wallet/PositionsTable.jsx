import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  History as HistoryIcon,
  Info,
  Calculator,
} from 'lucide-react';
import VariationBadge from './components/VariationBadge.jsx';

import tijolo from '../../assets/tijolo.png';
import papel from '../../assets/papel.png';
import hibrido from '../../assets/hibrido.png';
import fundosFundos from '../../assets/fundos-fundos.png';
import desenvolvimento from '../../assets/desenvolvimento.png';

const FII_SUBTYPE_ICONS = {
  Tijolo: tijolo,
  Papel: papel,
  Híbrido: hibrido,
  'Fundos de Fundos': fundosFundos,
  'Fundos De Fundos': fundosFundos,
  Desenvolvimento: desenvolvimento,
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const interpolateColor = (color1, color2, factor) => {
  if (!color1 || !color2 || factor === undefined) return null;
  const result = color1.slice().map((c, i) => {
    return Math.round(c + factor * (color2[i] - c));
  });
  return `rgb(${result.join(',')})`;
};

const COLOR_SCALE = {
  start: [226, 232, 240],
  end: [251, 191, 36],
};

const RentabilityBar = ({ value, maxAbsValue }) => {
  const absValue = Math.abs(value);
  const isPositive = value >= 0;
  const safeMax = maxAbsValue === 0 ? 1 : maxAbsValue;
  const width = Math.min(100, (absValue / safeMax) * 100);

  const colorClass = isPositive ? 'bg-emerald-500' : 'bg-rose-500';
  const textClass = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="flex items-center w-full gap-2 min-w-[140px]">
      <div className={`w-14 text-right font-bold text-xs ${textClass}`}>
        {isPositive ? '+' : ''}
        {value.toFixed(2)}%
      </div>
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex items-center">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

const AssetContributions = ({ history = [], ticker }) => {
  if (!history || history.length === 0)
    return (
      <div className="p-4 text-center text-xs text-gray-500">
        Sem histórico detalhado disponível.
      </div>
    );

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-b-lg border-t border-gray-200 dark:border-gray-700 shadow-inner">
      <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
        <HistoryIcon size={14} /> Histórico de Aportes: {ticker}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 text-left">Data</th>
              <th className="pb-2 text-center">Tipo</th>
              <th className="pb-2 text-center">Qtd</th>
              <th className="pb-2 text-right">Preço Un.</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.map((move, idx) => (
              <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-gray-800/50">
                <td className="py-2 text-gray-700 dark:text-gray-300">
                  {new Date(move.trade_date).toLocaleDateString('pt-BR')}
                </td>
                <td className="py-2 text-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase 
                    ${
                      move.type === 'stock'
                        ? 'bg-blue-100 text-blue-800'
                        : move.type === 'fii'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {move.type}
                  </span>
                </td>
                <td className="py-2 text-center font-mono text-gray-600 dark:text-gray-400">
                  {move.qty}
                </td>
                <td className="py-2 text-right font-mono text-gray-600 dark:text-gray-400">
                  {formatCurrency(move.price)}
                </td>
                <td className="py-2 text-right font-mono font-medium text-gray-800 dark:text-gray-200">
                  {formatCurrency(move.price * move.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const getFiiTypeStyle = (type) => {
  const t = type?.toLowerCase() || '';
  if (t.includes('tijolo')) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (t.includes('papel') || t.includes('recebíveis'))
    return 'bg-blue-100 text-blue-800 border-blue-200';
  if (t.includes('híbrido')) return 'bg-purple-100 text-purple-800 border-purple-200';
  if (t.includes('fundo de fundos') || t.includes('fof'))
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (t.includes('desenvolvimento')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

const getDisplayData = (row) => {
  const isFii = row.type === 'fii';

  const avgPrice = isFii && row.avg_price_adjusted ? row.avg_price_adjusted : row.purchase_price;
  const currentPrice = isFii && row.current_adjusted ? row.current_adjusted : row.current_price;

  let variationValue, rentabilityPercent;

  if (isFii && row.total_return_profit !== undefined) {
    variationValue = row.total_return_profit;
    rentabilityPercent = row.total_return_percent;
  } else {
    const costBasis = row.purchase_price * row.qty;
    const marketValue = row.current_price * row.qty;
    variationValue = marketValue - costBasis;
    rentabilityPercent = costBasis > 0 ? (variationValue / costBasis) * 100 : 0;
  }

  return {
    isFii,
    avgPrice,
    currentPrice,
    variationValue,
    rentabilityPercent,

    marketValue: row.total_value_current,
  };
};

const PositionsTable = ({
  filteredPositions,
  totalValue,
  selectedAssetTicker,
  setSelectedAssetTicker,
  categoryLabel,
  assetsHistoryMap,
}) => {
  const [expandedTicker, setExpandedTicker] = useState(null);

  const isFiiTable =
    categoryLabel === 'FIIs' ||
    (filteredPositions.length > 0 && filteredPositions.every((p) => p.type === 'fii'));

  const toggleExpand = (e, ticker) => {
    e.stopPropagation();
    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
  };

  const maxRentability = useMemo(() => {
    if (!filteredPositions || filteredPositions.length === 0) return 0.1;
    return Math.max(
      0.1,
      ...filteredPositions.map((p) => {
        const { rentabilityPercent } = getDisplayData(p);
        return Math.abs(rentabilityPercent);
      })
    );
  }, [filteredPositions]);

  const sortedPositions = useMemo(() => {
    return [...filteredPositions].sort((a, b) => {
      const dataA = getDisplayData(a);
      const dataB = getDisplayData(b);
      return dataB.rentabilityPercent - dataA.rentabilityPercent;
    });
  }, [filteredPositions]);

  const tableTotals = useMemo(() => {
    let sumQty = 0;
    let sumTotalValue = 0;
    let sumVariation = 0;
    let sumImpliedCost = 0;
    let sumShare = 0;

    sortedPositions.forEach((row) => {
      const { marketValue, variationValue } = getDisplayData(row);

      sumQty += row.qty;
      sumTotalValue += marketValue;
      sumVariation += variationValue;

      sumImpliedCost += marketValue - variationValue;

      const share = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;
      sumShare += share;
    });

    const totalRentabilityPercent = sumImpliedCost > 0 ? (sumVariation / sumImpliedCost) * 100 : 0;

    return {
      qty: sumQty,
      totalValue: sumTotalValue,
      totalCost: sumImpliedCost,
      variation: sumVariation,
      rentability: totalRentabilityPercent,
      share: sumShare,
    };
  }, [sortedPositions, totalValue]);

  const timeScaleData = useMemo(() => {
    const ages = sortedPositions.map((p) => {
      const history = assetsHistoryMap[p.ticker] || [];
      if (!history.length) return { ticker: p.ticker, days: 0 };
      const dates = history.map((h) => new Date(h.trade_date).getTime());
      const oldest = Math.min(...dates);
      const now = new Date().getTime();
      const diffTime = Math.abs(now - oldest);
      return {
        ticker: p.ticker,
        days: Math.ceil(diffTime / (1000 * 60 * 60 * 24)),
      };
    });

    if (ages.length === 0) return { min: 0, max: 0, map: {} };
    const daysValues = ages.map((a) => a.days);
    const min = Math.min(...daysValues);
    const max = Math.max(...daysValues);
    const map = {};
    ages.forEach((a) => {
      map[a.ticker] = a.days;
    });
    return { min, max, map };
  }, [sortedPositions, assetsHistoryMap]);

  const getTimeBadgeStyle = (ticker) => {
    const days = timeScaleData.map[ticker] || 0;
    const { min, max } = timeScaleData;
    if (max === min || max === 0) return {};
    const factor = (days - min) / (max - min);
    const bgColor = interpolateColor(COLOR_SCALE.start, COLOR_SCALE.end, factor);
    return { backgroundColor: bgColor, transition: 'background-color 0.5s ease' };
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          Detalhamento: {categoryLabel}
          {isFiiTable && (
            <div className="group relative">
              <Info size={16} className="text-blue-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50">
                Para FIIs, utilizamos Preço Médio e Atual <strong>Ajustados</strong> (descontando
                proventos) para calcular o Retorno Total real.
              </div>
            </div>
          )}
        </h3>
        <span className="text-xs text-gray-500">*Cotações atualizadas via B3/Supabase</span>
      </div>

      <div className="overflow-x-auto relative custom-scrollbar">
        {filteredPositions.length > 0 ? (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase font-medium">
              <tr>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-left sticky left-0 z-20 bg-gray-100 dark:bg-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Ativo
                </th>
                {isFiiTable && (
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center whitespace-nowrap">
                    TIPO
                  </th>
                )}
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Tempo
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Qtd
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  {isFiiTable ? 'Preço Médio (Adj)' : 'Preço Médio'}
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  {isFiiTable ? 'Preço Atual (Adj)' : 'Preço Atual'}
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Total (Real)
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Variação (R$)
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-left min-w-[140px]">
                  Rentabilidade (%)
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  % Carteira
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedPositions.map((row) => {
                const { avgPrice, currentPrice, variationValue, rentabilityPercent, marketValue } =
                  getDisplayData(row);
                const share = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;
                const isExpanded = expandedTicker === row.ticker;
                const assetAgeLabel = row.age || '-';
                const dynamicStyle = getTimeBadgeStyle(row.ticker);
                const hasDynamicColor = Object.keys(dynamicStyle).length > 0;
                const assetHistory = assetsHistoryMap[row.ticker] || [];

                return (
                  <React.Fragment key={row.ticker}>
                    <tr
                      className={`transition-colors cursor-pointer group ${
                        selectedAssetTicker === row.ticker
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                      onClick={() =>
                        setSelectedAssetTicker(selectedAssetTicker === row.ticker ? '' : row.ticker)
                      }
                    >
                      <td
                        className={`px-6 py-4 font-medium text-gray-900 dark:text-gray-100 sticky left-0 z-10 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${selectedAssetTicker === row.ticker ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => toggleExpand(e, row.ticker)}
                            className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-blue-500 transition-colors focus:outline-none"
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <span
                            className={`w-1 h-8 rounded-full ${row.type === 'stock' ? 'bg-blue-500' : row.type === 'fii' ? 'bg-yellow-500' : 'bg-purple-500'}`}
                          ></span>
                          <div className="flex flex-col">
                            <span className="font-bold whitespace-nowrap">{row.ticker}</span>
                            <span className="text-xs text-gray-500 font-normal whitespace-nowrap">
                              {row.name?.substring(0, 15)}
                              {row.name?.length > 15 ? '...' : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {isFiiTable && (
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <div className="flex justify-center items-center">
                            {FII_SUBTYPE_ICONS[row.asset_subtype] ? (
                              <div className="group relative flex justify-center items-center">
                                <div className="w-10 h-10 p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                                  <img
                                    src={FII_SUBTYPE_ICONS[row.asset_subtype]}
                                    alt={row.asset_subtype}
                                    className="w-full h-full object-contain opacity-90 group-hover:opacity-100"
                                  />
                                </div>
                              </div>
                            ) : (
                              <span
                                className={`px-2 py-1 rounded-md text-xs font-bold border ${getFiiTypeStyle(row.asset_subtype)}`}
                              >
                                {row.full_type || row.asset_subtype || 'Indefinido'}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <div className="flex justify-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono font-medium whitespace-nowrap ${!hasDynamicColor ? 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300' : 'text-gray-800 dark:text-gray-900 shadow-sm'}`}
                            style={hasDynamicColor ? dynamicStyle : {}}
                          >
                            <Clock
                              size={10}
                              className={
                                hasDynamicColor
                                  ? 'text-gray-700 dark:text-gray-800'
                                  : 'text-gray-400'
                              }
                            />
                            {assetAgeLabel}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300 font-mono whitespace-nowrap">
                        {row.qty}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatCurrency(avgPrice)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white font-mono whitespace-nowrap">
                        {formatCurrency(currentPrice)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100 font-mono whitespace-nowrap">
                        {formatCurrency(marketValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <VariationBadge value={variationValue} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap min-w-[140px]">
                        <RentabilityBar value={rentabilityPercent} maxAbsValue={maxRentability} />
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded">
                          {share.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-900/30">
                        <td
                          colSpan={isFiiTable ? '10' : '9'}
                          className="p-0 border-b border-gray-200 dark:border-gray-700 relative sticky left-0"
                        >
                          <div className="pl-12 w-screen max-w-[calc(100vw-60px)] md:max-w-4xl">
                            <AssetContributions ticker={row.ticker} history={assetHistory} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {}
              {sortedPositions.length > 0 && (
                <tr className="bg-indigo-50 dark:bg-indigo-900/20 border-t-2 border-indigo-100 dark:border-indigo-800 shadow-inner sticky bottom-0 z-10">
                  <td className="px-6 py-4 text-center">
                    <Calculator className="w-5 h-5 mx-auto text-indigo-400" />
                  </td>

                  {isFiiTable && <td className="px-6 py-4 text-center"></td>}

                  <td className="px-6 py-4 text-center font-black text-indigo-900 dark:text-indigo-100 tracking-wide text-xs uppercase">
                    TOTAL {categoryLabel !== 'Visão Geral' ? categoryLabel.toUpperCase() : 'GERAL'}
                  </td>

                  <td className="px-6 py-4 text-center font-bold text-indigo-900 dark:text-indigo-100 font-mono">
                    {tableTotals.qty.toFixed(0)}
                  </td>

                  {}
                  <td className="px-6 py-4 text-right font-mono text-xs font-bold text-indigo-800 dark:text-indigo-300">
                    {formatCurrency(tableTotals.totalCost)}
                  </td>

                  {}
                  <td className="px-6 py-4 text-center text-gray-400 font-mono text-xs">-</td>

                  <td className="px-6 py-4 text-right font-bold text-indigo-900 dark:text-indigo-100 font-mono border-l border-indigo-200 dark:border-indigo-800">
                    {formatCurrency(tableTotals.totalValue)}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap border-l border-indigo-100 dark:border-indigo-800/50">
                    <VariationBadge value={tableTotals.variation} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap min-w-[140px]">
                    <RentabilityBar value={tableTotals.rentability} maxAbsValue={maxRentability} />
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-xs font-semibold px-2.5 py-0.5 rounded">
                      {tableTotals.share.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">
            Você não possui ativos nesta categoria.
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionsTable;
