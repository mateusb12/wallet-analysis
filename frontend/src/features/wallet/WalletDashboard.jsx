import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  ArrowRight,
  BarChart2,
  Bug,
  Check,
  Clock,
  Copy,
  DollarSign,
  Percent,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import WalletHistoryChart from './WalletHistoryChart.jsx';
import DataConsistencyAlert from '../../components/DataConsistencyAlert.jsx';
import SourceDataTable from './SourceDataTable.jsx';
import PositionsTable from './PositionsTable.jsx';
import VariationBadge from './components/VariationBadge.jsx';

import {
  useWalletDashboardData,
  CATEGORIES_CONFIG,
  COLORS,
  TIME_RANGES,
  PROFIT_PERIODS,
} from './useWalletDashboardData.js';

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';
import iconTotal from '../../assets/all.png';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatPercent = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);

const WalletSkeleton = () => {
  return (
    <div className="p-8 dark:bg-gray-900 min-h-screen animate-pulse">
      {}
      <div className="mb-8">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-6"></div>
        {}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-2xl flex items-center h-24"
            >
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-xl mr-4 shrink-0"></div>
              <div className="flex flex-col flex-1 gap-2">
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-6 w-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 h-32 flex justify-between"
          >
            <div className="flex flex-col justify-between py-1">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-8 w-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl"></div>
          </div>
        ))}
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 h-48"
          >
            <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((row) => (
                <div key={row} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                  <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 h-96">
          <div className="flex justify-between mb-6">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded hidden sm:block"></div>
          </div>
          <div className="w-full h-64 bg-gray-100 dark:bg-gray-900/50 rounded flex items-end justify-center gap-2 px-4 pb-4">
            <div className="w-full h-1/3 bg-gray-200 dark:bg-gray-700 rounded-t"></div>
            <div className="w-full h-1/2 bg-gray-300 dark:bg-gray-600 rounded-t"></div>
            <div className="w-full h-2/3 bg-gray-200 dark:bg-gray-700 rounded-t"></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 h-96 flex flex-col items-center">
          <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="w-48 h-48 rounded-full border-8 border-gray-100 dark:border-gray-700 mb-4"></div>
          <div className="flex gap-2">
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>

      {}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-96">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-10 w-full bg-gray-50 dark:bg-gray-900/30 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, value, subtext, type = 'neutral', rawValue }) => {
  let colorClass = 'text-gray-900 dark:text-white';
  let iconColor = 'text-blue-500';
  let bgIcon = 'bg-blue-50 dark:bg-blue-900/20';

  if (type === 'profit') {
    const numericVal = rawValue !== undefined ? rawValue : parseFloat(value);
    const isPositive = numericVal >= 0;
    colorClass = isPositive
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
    iconColor = isPositive ? 'text-green-500' : 'text-red-500';
    bgIcon = isPositive ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20';
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl border border-blue-400/30 ${bgIcon} ${iconColor}`}>
          {title.includes('Investido') && <Wallet className="w-6 h-6" />}
          {title.includes('Atual') && <TrendingUp className="w-6 h-6" />}
          {(title.includes('Lucro') || title.includes('Prejuízo')) && (
            <DollarSign className="w-6 h-6" />
          )}
          {title.includes('%') && <Percent className="w-6 h-6" />}
        </div>
      </div>
    </div>
  );
};

const CategoryTabs = ({ activeTab, setActiveTab, categoryTotals }) => {
  return (
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
                className={`w-full h-full object-cover transition-all duration-300 ${!isActive && 'opacity-80 grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-110'}`}
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
  );
};

const TopPerformersSection = ({ positions }) => {
  const getTop3 = (type) => {
    return positions
      .filter((p) => p.type === type)
      .map((p) => {
        const cost = p.purchase_price * p.qty;
        const current = p.total_value_current || 0;
        const profit = current - cost;
        const yieldPercent = cost > 0 ? (profit / cost) * 100 : 0;
        return { ...p, yieldPercent };
      })
      .sort((a, b) => b.yieldPercent - a.yieldPercent)
      .slice(0, 3);
  };

  const topStocks = getTop3('stock');
  const topEtfs = getTop3('etf');
  const topFiis = getTop3('fii');

  const renderList = (title, items, icon) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex-1">
      <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <img src={icon} alt={title} className="w-6 h-6 object-contain" />
        </div>
        <h3 className="font-bold text-gray-800 dark:text-gray-200">{title}</h3>
      </div>

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.ticker} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                    idx === 0
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : idx === 1
                        ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        : 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'
                  }`}
                >
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200 group-hover:text-blue-500 transition-colors">
                    {item.ticker}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate w-24">{item.name}</p>
                </div>
              </div>
              <div className="text-right">
                <VariationBadge value={item.yieldPercent} isPercent />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 text-center py-4 italic">Sem ativos</div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-3 duration-700">
      {renderList('Top Ações', topStocks, iconStocks)}
      {renderList('Top ETFs', topEtfs, iconEtf)}
      {renderList('Top FIIs', topFiis, iconFiis)}
    </div>
  );
};

const PerformanceSection = ({
  selectedAssetTicker,
  setSelectedAssetTicker,
  activeTab,
  filteredPositions,
  timeRange,
  setTimeRange,
  loadingSpecific,
  displayedHistory,
  benchmarkName,
  earliestPurchaseDate,
  chartEvents,
  onChartClick,
}) => {
  return (
    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {selectedAssetTicker
              ? `${selectedAssetTicker} vs Benchmark`
              : `Performance vs ${benchmarkName}`}
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
        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-1 overflow-x-auto max-w-full">
          {TIME_RANGES.map((range) => (
            <button
              key={range.id}
              onClick={() => setTimeRange(range.id)}
              className={`
                px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap
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
          benchmarkName={benchmarkName}
          purchaseDate={earliestPurchaseDate}
          purchaseEvents={chartEvents}
          onPointClick={onChartClick}
        />
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded">
          Dados insuficientes para este período
        </div>
      )}
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-3 rounded-lg shadow-lg text-sm z-50">
        <p className="font-bold text-gray-800 dark:text-gray-100 mb-1 max-w-[200px] leading-tight">
          {data.name}
        </p>
        <p className="font-mono font-bold" style={{ color: data.payload.color || data.fill }}>
          {formatCurrency(data.value)}
        </p>
      </div>
    );
  }
  return null;
};

const AllocationSection = ({
  currentPieData,
  activeTab,
  allocationView,
  setAllocationView,
  selectedAssetTicker,
  setSelectedAssetTicker,
  totalValue,
  categoryLabel,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex flex-col items-center relative">
      <div className="w-full flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Alocação (
          {allocationView === 'general' && activeTab === 'total' ? 'Categorias' : categoryLabel})
        </h3>
        {activeTab === 'total' && (
          <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
            <button
              onClick={() => setAllocationView('general')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${allocationView === 'general' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Geral
            </button>
            <button
              onClick={() => setAllocationView('specific')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${allocationView === 'specific' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Específico
            </button>
          </div>
        )}
      </div>

      {currentPieData.length > 0 ? (
        <>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={currentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey={
                    allocationView === 'general' && activeTab === 'total'
                      ? 'value'
                      : 'total_value_current'
                  }
                  nameKey="name"
                >
                  {currentPieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
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
            {currentPieData.map((p, index) => {
              const isGeneral = allocationView === 'general' && activeTab === 'total';
              const label = isGeneral ? p.name : p.ticker;
              const color = isGeneral ? p.color : COLORS[index % COLORS.length];
              const value = isGeneral ? p.value : p.total_value_current;
              const percent = totalValue > 0 ? ((value / totalValue) * 100).toFixed(0) : 0;
              return (
                <div
                  key={label}
                  onClick={() => {
                    if (!isGeneral)
                      setSelectedAssetTicker(selectedAssetTicker === p.ticker ? '' : p.ticker);
                  }}
                  className={`flex items-center text-xs ${!isGeneral ? 'cursor-pointer' : ''} transition-opacity ${selectedAssetTicker && selectedAssetTicker !== p.ticker ? 'opacity-40' : 'opacity-100'} text-gray-600 dark:text-gray-300`}
                >
                  <span
                    className="w-3 h-3 rounded-full mr-1"
                    style={{ backgroundColor: color }}
                  ></span>
                  {label}{' '}
                  {isGeneral && (
                    <span className="ml-1 text-gray-400 font-normal">({percent}%)</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-500">
          Nenhum ativo nesta categoria
        </div>
      )}
    </div>
  );
};

function WalletDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const {
    activeTab,
    setActiveTab,
    allocationView,
    setAllocationView,
    timeRange,
    setTimeRange,
    selectedAssetTicker,
    setSelectedAssetTicker,
    loading,
    loadingSpecific,
    dataWarnings,
    profitPeriod,
    setProfitPeriod,
    highlightedDate,
    setHighlightedDate,
    debugShowEmpty,
    setDebugShowEmpty,

    positions,
    categoryTotals,
    filteredPositions,
    currentPieData,
    chartEvents,
    displayedHistory,
    totalValue,
    totalInvested,
    periodStats,
    availablePeriods,
    earliestPurchaseDate,
    showEmptyState,
    assetsHistoryMap,
  } = useWalletDashboardData(user);

  const handleCopyDashboard = () => {
    const dashboardSnapshot = {
      summary: {
        totalInvested,
        totalValue,
        periodStats,
      },
      categories: categoryTotals,
      positions: positions.map((p) => ({
        ticker: p.ticker,
        qty: p.qty,
        avgPrice: p.purchase_price,
        currentPrice: p.current_price,
        total: p.total_value_current,
        type: p.type,
        transactions: assetsHistoryMap[p.ticker] || [],
      })),
    };

    const jsonString = JSON.stringify(dashboardSnapshot, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return <WalletSkeleton />;
  }

  return (
    <div className="p-8 dark:bg-gray-900 min-h-screen font-sans animate-fade-in">
      <DataConsistencyAlert warnings={dataWarnings} className="mb-6" />

      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            Meu Portfólio
            {import.meta.env.DEV && (
              <button
                onClick={() => setDebugShowEmpty(!debugShowEmpty)}
                className={`p-2 rounded-lg transition-all border ${
                  debugShowEmpty
                    ? 'bg-orange-100 text-orange-600 border-orange-200'
                    : 'bg-gray-100 text-gray-400 border-gray-200 hover:text-orange-500'
                }`}
                title="Simular conta vazia (Debug - Dev Only)"
              >
                <Bug size={20} />
              </button>
            )}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Acompanhe a evolução do seu patrimônio em tempo real.
          </p>
        </div>

        {!showEmptyState && (
          <div className="flex gap-2">
            <button
              onClick={handleCopyDashboard}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 border border-gray-200 dark:border-gray-700 rounded-lg transition-all shadow-sm font-medium text-sm"
              title="Copiar JSON dos dados atuais"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Dados</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 animate-in fade-in duration-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-full shadow-lg mb-6 ring-8 ring-gray-100 dark:ring-gray-700/50">
            <BarChart2 className="w-16 h-16 text-blue-500" />
          </div>

          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center">
            Sua carteira está vazia
          </h3>

          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-8 leading-relaxed">
            Parece que você ainda não cadastrou nenhum ativo. Para visualizar gráficos de
            rentabilidade, distribuição e histórico, você precisa importar seus dados da B3.
          </p>

          <button
            onClick={() => navigate('/gerenciar-ativos')}
            className="group flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-1"
          >
            <Wallet className="w-5 h-5" />
            Gerenciar e Importar Ativos
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <p className="mt-6 text-xs text-gray-400 uppercase tracking-widest font-semibold">
            Configuração Rápida em 3 minutos
          </p>
        </div>
      ) : (
        <>
          <CategoryTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            categoryTotals={categoryTotals}
          />

          <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-4 gap-2">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Resumo Financeiro
              </h3>

              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-400 transition-colors">
                <Clock className="w-4 h-4 text-blue-500 ml-2" />
                <select
                  value={profitPeriod}
                  onChange={(e) => setProfitPeriod(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer py-1 pr-8 outline-none"
                >
                  {availablePeriods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <SummaryCard
                title="Total Investido"
                value={formatCurrency(totalInvested)}
                subtext={selectedAssetTicker ? selectedAssetTicker : 'Custo de aquisição'}
              />
              <SummaryCard
                title="Valor Atual"
                value={formatCurrency(totalValue)}
                subtext={`Cotação Atual (${selectedAssetTicker ? selectedAssetTicker : CATEGORIES_CONFIG[activeTab].label})`}
              />
              <SummaryCard
                title={periodStats.profit >= 0 ? 'Lucro (R$)' : 'Prejuízo (R$)'}
                value={formatCurrency(periodStats.profit)}
                rawValue={periodStats.profit}
                type="profit"
                subtext={periodStats.labelSuffix}
              />
              <SummaryCard
                title="Rentabilidade (%)"
                value={formatPercent(periodStats.yield)}
                rawValue={periodStats.yield}
                type="profit"
                subtext={periodStats.labelSuffix}
              />
            </div>

            {activeTab === 'total' && <TopPerformersSection positions={positions} />}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              <PerformanceSection
                selectedAssetTicker={selectedAssetTicker}
                setSelectedAssetTicker={setSelectedAssetTicker}
                activeTab={activeTab}
                filteredPositions={filteredPositions}
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                loadingSpecific={loadingSpecific}
                displayedHistory={displayedHistory}
                benchmarkName={CATEGORIES_CONFIG[activeTab].benchmark}
                earliestPurchaseDate={earliestPurchaseDate}
                chartEvents={chartEvents}
                onChartClick={setHighlightedDate}
              />
              <AllocationSection
                currentPieData={currentPieData}
                activeTab={activeTab}
                allocationView={allocationView}
                setAllocationView={setAllocationView}
                selectedAssetTicker={selectedAssetTicker}
                setSelectedAssetTicker={setSelectedAssetTicker}
                totalValue={totalValue}
                categoryLabel={CATEGORIES_CONFIG[activeTab].label}
              />
            </div>

            <PositionsTable
              filteredPositions={filteredPositions}
              totalValue={totalValue}
              selectedAssetTicker={selectedAssetTicker}
              setSelectedAssetTicker={setSelectedAssetTicker}
              categoryLabel={CATEGORIES_CONFIG[activeTab].label}
              assetsHistoryMap={assetsHistoryMap}
            />

            <SourceDataTable
              data={displayedHistory}
              benchmarkName={CATEGORIES_CONFIG[activeTab].benchmark}
              isSpecificAsset={!!selectedAssetTicker}
              assetTicker={selectedAssetTicker}
              highlightDate={highlightedDate}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default WalletDashboard;
