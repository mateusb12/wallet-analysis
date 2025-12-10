import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchWalletPositions,
  fetchWalletPerformanceHistory,
  fetchSpecificAssetHistory,
} from '../../services/walletDataService.js';
import { fetchB3Prices } from '../../services/b3service.js';
import WalletHistoryChart from './WalletHistoryChart.jsx';
import DataConsistencyAlert from '../../components/DataConsistencyAlert.jsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';
import iconTotal from '../../assets/all.png';

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-3 rounded-lg shadow-lg text-sm z-50">
        <p className="font-bold text-gray-800 dark:text-gray-100 mb-1 max-w-[200px] leading-tight">
          {data.name}
        </p>
        <p className="text-blue-600 dark:text-blue-400 font-mono font-bold">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            data.value
          )}
        </p>
      </div>
    );
  }
  return null;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatPercent = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);

const CATEGORIES_CONFIG = {
  total: { label: 'Visão Geral', benchmark: 'CDI', icon: iconTotal },
  stock: { label: 'Ações', benchmark: 'IBOV', icon: iconStocks },
  etf: { label: 'ETFs', benchmark: 'S&P 500', icon: iconEtf },
  fii: { label: 'FIIs', benchmark: 'IFIX', icon: iconFiis },
};

const TIME_RANGES = [
  { id: '1M', label: '1M', days: 30 },
  { id: '3M', label: '3M', days: 90 },
  { id: '6M', label: '6M', days: 180 },
  { id: 'YTD', label: 'YTD', days: 'ytd' },
  { id: 'MAX', label: 'Max', days: 'max' },
];

function WalletDashboard() {
  const [positions, setPositions] = useState([]);
  const [fullHistoryData, setFullHistoryData] = useState({
    stock: [],
    etf: [],
    fii: [],
    total: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('total');
  const [timeRange, setTimeRange] = useState('MAX');

  const [selectedAssetTicker, setSelectedAssetTicker] = useState('');
  const [specificAssetHistory, setSpecificAssetHistory] = useState([]);
  const [loadingSpecific, setLoadingSpecific] = useState(false);
  const [dataWarnings, setDataWarnings] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [posData, histData] = await Promise.all([
          fetchWalletPositions(),
          fetchWalletPerformanceHistory(),
        ]);

        const positionsWithRealPrices = await Promise.all(
          posData.map(async (p) => {
            try {
              const { data } = await fetchB3Prices(p.ticker, 1, 1);

              let currentPrice = p.purchase_price;
              let priceSource = 'compra';

              if (data && data.length > 0) {
                currentPrice = parseFloat(data[0].close);
                priceSource = 'b3_real';
              }

              return {
                ...p,
                current_price: currentPrice,
                total_value_current: currentPrice * p.qty,
                price_source: priceSource,
              };
            } catch (err) {
              console.error(`Erro ao buscar preço para ${p.ticker}`, err);

              return {
                ...p,
                current_price: p.purchase_price,
                total_value_current: p.purchase_price * p.qty,
                price_source: 'erro_fallback',
              };
            }
          })
        );

        setPositions(positionsWithRealPrices);
        setFullHistoryData(histData);

        if (histData.warnings && histData.warnings.length > 0) {
          setDataWarnings(histData.warnings);
        } else {
          setDataWarnings([]);
        }
      } catch (error) {
        console.error('Failed to load wallet data', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedAssetTicker) {
      setSpecificAssetHistory([]);
      return;
    }

    const loadSpecific = async () => {
      setLoadingSpecific(true);
      try {
        const data = await fetchSpecificAssetHistory(selectedAssetTicker, 12);
        setSpecificAssetHistory(data);
      } catch (error) {
        console.error('Failed to fetch specific asset history', error);
      } finally {
        setLoadingSpecific(false);
      }
    };

    loadSpecific();
  }, [selectedAssetTicker]);

  useEffect(() => {
    setSelectedAssetTicker('');
  }, [activeTab]);

  const categoryTotals = useMemo(() => {
    const totals = { stock: 0, etf: 0, fii: 0, total: 0 };
    positions.forEach((p) => {
      const value = p.total_value_current || 0;
      if (totals[p.type] !== undefined) {
        totals[p.type] += value;
      }
      totals.total += value;
    });
    return totals;
  }, [positions]);

  const filteredPositions = useMemo(() => {
    if (activeTab === 'total') return positions;
    return positions.filter((p) => p.type === activeTab);
  }, [positions, activeTab]);

  // Determine the events (dots) to show on chart
  const chartEvents = useMemo(() => {
    if (selectedAssetTicker) {
      return positions.filter((p) => p.ticker === selectedAssetTicker);
    }
    return filteredPositions;
  }, [selectedAssetTicker, filteredPositions, positions]);

  const earliestPurchaseDate = useMemo(() => {
    if (selectedAssetTicker) {
      const asset = positions.find((p) => p.ticker === selectedAssetTicker);
      return asset ? asset.purchaseDate : null;
    }

    if (filteredPositions.length === 0) return null;

    const dates = filteredPositions.map((p) => new Date(p.purchaseDate).getTime());
    const minDate = new Date(Math.min(...dates));
    return minDate.toISOString().split('T')[0];
  }, [filteredPositions, selectedAssetTicker, positions]);

  const displayedHistory = useMemo(() => {
    const rawData = selectedAssetTicker ? specificAssetHistory : fullHistoryData[activeTab] || [];

    if (rawData.length === 0) return [];

    let processedData = rawData;

    // Strict Filtering: Ensure no data points exist before the earliest purchase date.
    if (earliestPurchaseDate) {
      processedData = processedData.filter((item) => item.trade_date >= earliestPurchaseDate);
    }

    if (timeRange === 'MAX') return processedData;

    const today = new Date();
    let startDate = new Date();

    if (timeRange === 'YTD') {
      startDate = new Date(today.getFullYear(), 0, 1);
    } else {
      const rangeConfig = TIME_RANGES.find((r) => r.id === timeRange);
      if (rangeConfig && typeof rangeConfig.days === 'number') {
        startDate.setDate(today.getDate() - rangeConfig.days);
      }
    }

    // Double check: if the calculated time range start date is older than purchase date,
    // snap it to the purchase date.
    if (earliestPurchaseDate && startDate < new Date(earliestPurchaseDate)) {
      startDate = new Date(earliestPurchaseDate);
    }

    return processedData.filter((item) => new Date(item.trade_date) >= startDate);
  }, [
    fullHistoryData,
    activeTab,
    timeRange,
    selectedAssetTicker,
    specificAssetHistory,
    earliestPurchaseDate,
  ]);

  const totalValue = filteredPositions.reduce(
    (acc, curr) => acc + (curr.total_value_current || 0),
    0
  );
  const totalAssets = filteredPositions.length;

  const largestPosition = filteredPositions.reduce(
    (prev, current) =>
      (prev.total_value_current || 0) > (current.total_value_current || 0) ? prev : current,
    { ticker: '-', total_value_current: 0, name: '' }
  );

  const largestShare =
    totalValue > 0 ? ((largestPosition.total_value_current || 0) / totalValue) * 100 : 0;

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

  const renderVariation = (value, isPercent = false) => {
    const numValue = parseFloat(value);

    if (Math.abs(numValue) < 0.001) {
      return (
        <span className="text-gray-500 font-medium">
          <Minus className="w-3 h-3 inline mr-1" />
          0,00{isPercent ? '%' : ''}
        </span>
      );
    }

    const isPositive = numValue > 0;
    const ColorClass = isPositive
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
    const BgClass = isPositive
      ? 'bg-green-100 dark:bg-green-900/30'
      : 'bg-red-100 dark:bg-red-900/30';
    const Icon = isPositive ? ArrowUp : ArrowDown;

    return (
      <div
        className={`flex items-center justify-center gap-1 px-2 py-0.5 rounded-md min-w-[80px] ${BgClass} ${ColorClass}`}
      >
        <Icon className="w-3 h-3" />
        <span className="font-bold text-xs">
          {isPercent ? formatPercent(numValue) : formatCurrency(numValue)}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl text-gray-500 dark:text-gray-400 animate-pulse">
          Carregando carteira e atualizando preços...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 dark:bg-gray-900 min-h-screen font-sans animate-fade-in">
      <DataConsistencyAlert warnings={dataWarnings} className="mb-6" />

      {/* Header Cards (Summary Categories) */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Meu Portfólio</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Object.entries(CATEGORIES_CONFIG).map(([key, config]) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`
                  relative flex items-center p-5 rounded-2xl border transition-all duration-300 group text-left
                  ${
                    isActive
                      ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/30 transform scale-[1.02]'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                  }
                `}
              >
                <div
                  className={`
                  flex-shrink-0 w-16 h-16 rounded-xl mr-4 transition-colors duration-300 overflow-hidden flex items-center justify-center
                  ${isActive ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30'}
                `}
                >
                  <img
                    src={config.icon}
                    alt={config.label}
                    className={`w-full h-full object-cover transition-all duration-300 ${
                      !isActive &&
                      'opacity-80 grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-110'
                    }`}
                  />
                </div>

                <div className="flex flex-col">
                  <span
                    className={`text-sm font-medium mb-1 ${isActive ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    {config.label}
                  </span>

                  <span
                    className={`text-xl font-bold tracking-tight ${isActive ? 'text-white' : 'text-gray-900 dark:text-white'}`}
                  >
                    {formatCurrency(categoryTotals[key])}
                  </span>
                </div>

                {isActive && (
                  <span className="absolute top-3 right-3 w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Patrimônio ({CATEGORIES_CONFIG[activeTab].label})
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(totalValue)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Qtd. Ativos</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAssets}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Maior Posição</p>
            <p className="text-2xl font-bold text-blue-500">{largestPosition.ticker}</p>
            <p className="text-xs text-gray-400">
              {largestPosition.ticker !== '-' &&
                `${largestPosition.name.substring(0, 15)}... (${largestShare.toFixed(0)}%)`}
            </p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {selectedAssetTicker
                    ? `${selectedAssetTicker} vs Benchmark`
                    : `Performance vs ${CATEGORIES_CONFIG[activeTab].benchmark}`}
                </h3>

                {activeTab !== 'total' && (
                  <select
                    value={selectedAssetTicker}
                    onChange={(e) => setSelectedAssetTicker(e.target.value)}
                    className="mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                  >
                    <option value="">Carteira Completa</option>
                    {filteredPositions.map((pos) => (
                      <option key={pos.ticker} value={pos.ticker}>
                        {pos.ticker}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setTimeRange(range.id)}
                    className={`
                       px-3 py-1 text-xs font-medium rounded-md transition-all
                       ${
                         timeRange === range.id
                           ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                           : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                       }
                     `}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingSpecific ? (
              <div className="h-64 flex items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded">
                Carregando dados de {selectedAssetTicker}...
              </div>
            ) : displayedHistory.length > 0 ? (
              <WalletHistoryChart
                data={displayedHistory}
                benchmarkName={CATEGORIES_CONFIG[activeTab].benchmark}
                purchaseDate={earliestPurchaseDate}
                purchaseEvents={chartEvents}
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded">
                Dados insuficientes para este período
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex flex-col items-center">
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200 w-full text-left">
              Alocação ({CATEGORIES_CONFIG[activeTab].label})
            </h3>
            {filteredPositions.length > 0 ? (
              <>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={filteredPositions}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="total_value_current"
                        nameKey="name"
                      >
                        {filteredPositions.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                            stroke={selectedAssetTicker === entry.ticker ? '#fff' : 'none'}
                            strokeWidth={selectedAssetTicker === entry.ticker ? 2 : 0}
                            opacity={
                              selectedAssetTicker && selectedAssetTicker !== entry.ticker ? 0.3 : 1
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-4 max-h-24 overflow-y-auto custom-scrollbar">
                  {filteredPositions.map((p, index) => (
                    <div
                      key={p.ticker}
                      onClick={() =>
                        setSelectedAssetTicker(selectedAssetTicker === p.ticker ? '' : p.ticker)
                      }
                      className={`flex items-center text-xs cursor-pointer transition-opacity ${selectedAssetTicker && selectedAssetTicker !== p.ticker ? 'opacity-40' : 'opacity-100'} text-gray-600 dark:text-gray-300`}
                    >
                      <span
                        className="w-3 h-3 rounded-full mr-1"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></span>
                      {p.ticker}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                Nenhum ativo nesta categoria
              </div>
            )}
          </div>
        </div>

        {/* Detailed Table Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Detalhamento: {CATEGORIES_CONFIG[activeTab].label}
            </h3>
            <span className="text-xs text-gray-500">*Cotações atualizadas via B3/Supabase</span>
          </div>
          <div className="overflow-x-auto">
            {filteredPositions.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase font-medium">
                  <tr>
                    <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                      Ativo
                    </th>
                    <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                      Quant.
                    </th>
                    <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-right">
                      Preço Médio
                    </th>
                    <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-right">
                      Preço Atual
                    </th>
                    <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-right">
                      Total
                    </th>
                    <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                      Variação (R$)
                    </th>
                    <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                      Rentab. (%)
                    </th>
                    <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                      % Cart.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPositions.map((row) => {
                    const currentPrice = row.current_price;
                    const costBasis = row.purchase_price * row.qty;
                    const marketValue = currentPrice * row.qty;

                    const variationValue = marketValue - costBasis;
                    const rentabilityPercent =
                      costBasis > 0 ? (variationValue / costBasis) * 100 : 0;

                    const share = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;

                    return (
                      <tr
                        key={row.ticker}
                        className={`transition-colors ${selectedAssetTicker === row.ticker ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                        onClick={() =>
                          setSelectedAssetTicker(
                            selectedAssetTicker === row.ticker ? '' : row.ticker
                          )
                        }
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Ticker & Name */}
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-1 h-8 rounded-full ${
                                row.type === 'stock'
                                  ? 'bg-blue-500'
                                  : row.type === 'fii'
                                    ? 'bg-yellow-500'
                                    : 'bg-purple-500'
                              }`}
                            ></span>
                            <div className="flex flex-col">
                              <span className="font-bold">{row.ticker}</span>
                              <span className="text-xs text-gray-500 font-normal">
                                {row.name.substring(0, 20)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300 font-mono">
                          {row.qty}
                        </td>

                        {/* Purchase Price */}
                        <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400 font-mono">
                          {formatCurrency(row.purchase_price)}
                        </td>

                        {/* Current Price */}
                        <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white font-mono">
                          {formatCurrency(currentPrice)}
                        </td>

                        {/* Total Value */}
                        <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100 font-mono">
                          {formatCurrency(marketValue)}
                        </td>

                        {/* Variation R$ */}
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            {renderVariation(variationValue, false)}
                          </div>
                        </td>

                        {/* Rentability % */}
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            {renderVariation(rentabilityPercent, true)}
                          </div>
                        </td>

                        {/* Share % */}
                        <td className="px-6 py-4 text-center">
                          <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded">
                            {share.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
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
      </div>
    </div>
  );
}

export default WalletDashboard;
