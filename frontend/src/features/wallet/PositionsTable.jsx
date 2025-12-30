import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Clock, History as HistoryIcon } from 'lucide-react';
import VariationBadge from './components/VariationBadge.jsx';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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
      {}
      <div className={`w-14 text-right font-bold text-xs ${textClass}`}>
        {isPositive ? '+' : ''}
        {value.toFixed(2)}%
      </div>

      {}
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
    return <div className="p-4 text-center text-xs text-gray-500">Sem histórico registrado.</div>;

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

const PositionsTable = ({
  filteredPositions,
  totalValue,
  selectedAssetTicker,
  setSelectedAssetTicker,
  categoryLabel,
  assetsHistoryMap,
}) => {
  const [expandedTicker, setExpandedTicker] = useState(null);

  const calculateAssetAge = (history) => {
    if (!history || history.length === 0) return '-';

    const dates = history.map((h) => new Date(h.trade_date + 'T12:00:00').getTime());
    const oldest = new Date(Math.min(...dates));
    const now = new Date();

    let years = now.getFullYear() - oldest.getFullYear();
    let months = now.getMonth() - oldest.getMonth();
    let days = now.getDate() - oldest.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      days += prevMonthLastDay;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years}a`);
    if (months > 0) parts.push(`${months}m`);
    if (days > 0) parts.push(`${days}d`);

    if (parts.length === 0) return '0d';

    return parts.join(' ');
  };

  const toggleExpand = (e, ticker) => {
    e.stopPropagation();
    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
  };

  const maxRentability = useMemo(() => {
    if (!filteredPositions || filteredPositions.length === 0) return 0.1;

    const maxVal = Math.max(
      0.1,
      ...filteredPositions.map((p) => {
        const cost = p.purchase_price * p.qty;
        const current = p.current_price * p.qty;
        if (cost <= 0) return 0;
        return Math.abs(((current - cost) / cost) * 100);
      })
    );
    return maxVal;
  }, [filteredPositions]);

  const sortedPositions = useMemo(() => {
    return [...filteredPositions].sort((a, b) => {
      const costA = a.purchase_price * a.qty;
      const currentA = a.current_price * a.qty;
      const rentA = costA > 0 ? ((currentA - costA) / costA) * 100 : 0;

      const costB = b.purchase_price * b.qty;
      const currentB = b.current_price * b.qty;
      const rentB = costB > 0 ? ((currentB - costB) / costB) * 100 : 0;

      return rentB - rentA;
    });
  }, [filteredPositions]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Detalhamento: {categoryLabel}
        </h3>
        <span className="text-xs text-gray-500">*Cotações atualizadas via B3/Supabase</span>
      </div>
      <div className="overflow-x-auto">
        {filteredPositions.length > 0 ? (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase font-medium">
              <tr>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Ativo
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Tempo
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Qtd
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Preço Médio
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Preço Atual
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Total
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  Variação (R$)
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-left min-w-[160px]">
                  Rentabilidade (%)
                </th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                  % Carteira
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedPositions.map((row) => {
                const currentPrice = row.current_price;
                const costBasis = row.purchase_price * row.qty;
                const marketValue = currentPrice * row.qty;
                const variationValue = marketValue - costBasis;
                const rentabilityPercent = costBasis > 0 ? (variationValue / costBasis) * 100 : 0;
                const share = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;
                const isExpanded = expandedTicker === row.ticker;
                const assetHistory = assetsHistoryMap[row.ticker] || [];

                const assetAge = calculateAssetAge(assetHistory);

                return (
                  <React.Fragment key={row.ticker}>
                    <tr
                      className={`transition-colors cursor-pointer ${
                        selectedAssetTicker === row.ticker
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                      onClick={() =>
                        setSelectedAssetTicker(selectedAssetTicker === row.ticker ? '' : row.ticker)
                      }
                    >
                      {}
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => toggleExpand(e, row.ticker)}
                            className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-blue-500 transition-colors focus:outline-none"
                            title="Ver histórico de aportes"
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>

                          <span
                            className={`w-1 h-8 rounded-full ${row.type === 'stock' ? 'bg-blue-500' : row.type === 'fii' ? 'bg-yellow-500' : 'bg-purple-500'}`}
                          ></span>

                          <div className="flex flex-col">
                            <span className="font-bold">{row.ticker}</span>
                            <span className="text-xs text-gray-500 font-normal">
                              {row.name.substring(0, 20)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {}
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono font-medium bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600/50 whitespace-nowrap">
                            <Clock size={10} className="text-gray-400" />
                            {assetAge}
                          </span>
                        </div>
                      </td>

                      {}
                      <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300 font-mono">
                        {row.qty}
                      </td>

                      <td className="px-6 py-4 text-right font-mono text-gray-600 dark:text-gray-400">
                        {formatCurrency(row.purchase_price)}
                      </td>

                      <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white font-mono">
                        {formatCurrency(currentPrice)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100 font-mono">
                        {formatCurrency(marketValue)}
                      </td>
                      <td className="px-6 py-4">
                        <VariationBadge value={variationValue} />
                      </td>

                      <td className="px-6 py-4">
                        <RentabilityBar value={rentabilityPercent} maxAbsValue={maxRentability} />
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded">
                          {share.toFixed(1)}%
                        </span>
                      </td>
                    </tr>

                    {}
                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-900/30 animate-in fade-in slide-in-from-top-2 duration-300">
                        <td
                          colSpan="9"
                          className="p-0 border-b border-gray-200 dark:border-gray-700 relative"
                        >
                          <div className="absolute left-[34px] top-0 bottom-0 w-[2px] bg-gray-200 dark:bg-gray-700 block"></div>
                          <div className="pl-12">
                            <AssetContributions ticker={row.ticker} history={assetHistory} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
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
