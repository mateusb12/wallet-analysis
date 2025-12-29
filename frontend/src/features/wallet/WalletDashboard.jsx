import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchWalletPositions,
  fetchWalletPerformanceHistory,
  fetchSpecificAssetHistory,
} from '../../services/walletDataService.js';
import { fetchB3Prices } from '../../services/b3service.js';
import WalletHistoryChart from './WalletHistoryChart.jsx';
import DataConsistencyAlert from '../../components/DataConsistencyAlert.jsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Wallet,
  TrendingUp,
  DollarSign,
  Percent,
  Clock,
  Bug,
  BarChart2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  History as HistoryIcon,
} from 'lucide-react';

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';
import iconTotal from '../../assets/all.png';
import SourceDataTable from './SourceDataTable.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

const CATEGORIES_CONFIG = {
  total: { label: 'Visão Geral', benchmark: 'CDI', icon: iconTotal },
  stock: { label: 'Ações', benchmark: 'IBOV', icon: iconStocks },
  etf: { label: 'ETFs', benchmark: 'S&P 500', icon: iconEtf },
  fii: { label: 'FIIs', benchmark: 'IFIX', icon: iconFiis },
};

const TIME_RANGES = [
  { id: 'DEFAULT', label: 'Desde Compra', offsetMonths: 0 },
  { id: 'PRE_1M', label: '1M Antes', offsetMonths: 1 },
  { id: 'PRE_3M', label: '3M Antes', offsetMonths: 3 },
  { id: 'PRE_6M', label: '6M Antes', offsetMonths: 6 },
  { id: 'MAX', label: 'Max Hist.', offsetMonths: 999 },
];

export const PROFIT_PERIODS = [
  { id: 'total', label: 'Total (Acumulado)' },
  { id: 'day', label: 'Média por Dia' },
  { id: 'month', label: 'Média por Mês' },
  { id: 'year', label: 'Média por Ano (Projeção)' },
];

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
            {}
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

const RentabilityBar = ({ value, maxAbsValue }) => {
  const absValue = Math.abs(value);
  const isPositive = value >= 0;

  const width = Math.min(100, (absValue / maxAbsValue) * 100);

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
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    move.price
                  )}
                </td>
                <td className="py-2 text-right font-mono font-medium text-gray-800 dark:text-gray-200">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    move.price * move.qty
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const VariationBadge = ({ value, isPercent = false }) => {
  const numValue = parseFloat(value);
  if (Math.abs(numValue) < 0.001) {
    return (
      <span className="text-gray-500 font-medium flex items-center">
        <Minus className="w-3 h-3 mr-1" />
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
      className={`
      flex items-center justify-center gap-1 px-2 py-0.5 rounded-md min-w-[80px]
      ${BgClass} ${ColorClass}
      border border-solid
      ${isPositive ? 'border-green-500/40' : 'border-red-500/40'}
    `}
    >
      <Icon className="w-3 h-3" />
      <span className="font-bold text-xs">
        {isPercent ? formatPercent(numValue) : formatCurrency(numValue)}
      </span>
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

const PositionsTable = ({
  filteredPositions,
  totalValue,
  selectedAssetTicker,
  setSelectedAssetTicker,
  categoryLabel,
  assetsHistoryMap,
}) => {
  const [expandedTicker, setExpandedTicker] = useState(null);

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
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Ativo</th>
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
                {}
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-left min-w-[160px]">
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
                const rentabilityPercent = costBasis > 0 ? (variationValue / costBasis) * 100 : 0;
                const share = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;
                const isExpanded = expandedTicker === row.ticker;
                const assetHistory = assetsHistoryMap[row.ticker] || [];

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

                      {}
                      <td className="px-6 py-4">
                        <RentabilityBar value={rentabilityPercent} maxAbsValue={maxRentability} />
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded">
                          {share.toFixed(1)}%
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-900/30 animate-in fade-in slide-in-from-top-2 duration-300">
                        <td
                          colSpan="8"
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

function WalletDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [positions, setPositions] = useState([]);
  const [fullHistoryData, setFullHistoryData] = useState({
    stock: [],
    etf: [],
    fii: [],
    total: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('total');
  const [allocationView, setAllocationView] = useState('specific');
  const [timeRange, setTimeRange] = useState('DEFAULT');
  const [selectedAssetTicker, setSelectedAssetTicker] = useState('');
  const [specificAssetHistory, setSpecificAssetHistory] = useState([]);
  const [loadingSpecific, setLoadingSpecific] = useState(false);
  const [dataWarnings, setDataWarnings] = useState([]);

  const [profitPeriod, setProfitPeriod] = useState('total');

  const [highlightedDate, setHighlightedDate] = useState(null);

  const [debugShowEmpty, setDebugShowEmpty] = useState(false);
  const [assetsHistoryMap, setAssetsHistoryMap] = useState({});

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [posData, histData, purchasesResponse] = await Promise.all([
          fetchWalletPositions(),
          fetchWalletPerformanceHistory(),
          fetch(`${API_URL}/wallet/purchases?user_id=${user.id}`),
        ]);

        let purchasesMap = {};
        if (purchasesResponse.ok) {
          const purchasesData = await purchasesResponse.json();

          purchasesData.forEach((move) => {
            if (!purchasesMap[move.ticker]) {
              purchasesMap[move.ticker] = [];
            }
            purchasesMap[move.ticker].push(move);
          });

          Object.keys(purchasesMap).forEach((ticker) => {
            purchasesMap[ticker].sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));
          });
        }
        setAssetsHistoryMap(purchasesMap);

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
        if (histData.warnings && histData.warnings.length > 0) setDataWarnings(histData.warnings);
        else setDataWarnings([]);
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
        const data = await fetchSpecificAssetHistory(selectedAssetTicker, 60);
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
    setTimeRange('DEFAULT');
    setHighlightedDate(null);
    if (activeTab !== 'total') setAllocationView('specific');
  }, [activeTab]);

  const categoryTotals = useMemo(() => {
    const totals = { stock: 0, etf: 0, fii: 0, total: 0 };
    positions.forEach((p) => {
      const value = p.total_value_current || 0;
      if (totals[p.type] !== undefined) totals[p.type] += value;
      totals.total += value;
    });
    return totals;
  }, [positions]);

  const filteredPositions = useMemo(() => {
    if (activeTab === 'total') return positions;
    return positions.filter((p) => p.type === activeTab);
  }, [positions, activeTab]);

  const summaryPositions = useMemo(() => {
    if (selectedAssetTicker)
      return filteredPositions.filter((p) => p.ticker === selectedAssetTicker);
    return filteredPositions;
  }, [filteredPositions, selectedAssetTicker]);

  const generalAllocationData = useMemo(() => {
    return [
      { name: 'Ações', value: categoryTotals.stock, color: '#3b82f6' },
      { name: 'ETFs', value: categoryTotals.etf, color: '#f59e0b' },
      { name: 'FIIs', value: categoryTotals.fii, color: '#10b981' },
    ].filter((item) => item.value > 0);
  }, [categoryTotals]);

  const currentPieData = useMemo(() => {
    if (activeTab === 'total' && allocationView === 'general') return generalAllocationData;
    return filteredPositions.map((pos, index) => ({
      ...pos,
      color: COLORS[index % COLORS.length],
    }));
  }, [activeTab, allocationView, generalAllocationData, filteredPositions]);

  const chartEvents = useMemo(() => {
    if (selectedAssetTicker) return positions.filter((p) => p.ticker === selectedAssetTicker);
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
    const anchorDateString = earliestPurchaseDate;

    if (anchorDateString) {
      const purchaseDateObj = new Date(anchorDateString);
      const rangeConfig = TIME_RANGES.find((r) => r.id === timeRange);
      if (timeRange === 'MAX') return processedData;
      let startDate = new Date(purchaseDateObj);
      if (rangeConfig && rangeConfig.offsetMonths > 0) {
        startDate.setMonth(startDate.getMonth() - rangeConfig.offsetMonths);
      }
      return processedData.filter((item) => new Date(item.trade_date) >= startDate);
    }
    return processedData;
  }, [
    fullHistoryData,
    activeTab,
    timeRange,
    selectedAssetTicker,
    specificAssetHistory,
    earliestPurchaseDate,
  ]);

  const totalValue = summaryPositions.reduce(
    (acc, curr) => acc + (curr.total_value_current || 0),
    0
  );
  const totalInvested = summaryPositions.reduce(
    (acc, curr) => acc + curr.purchase_price * curr.qty,
    0
  );

  const walletAgeInDays = useMemo(() => {
    if (!earliestPurchaseDate) return 0;
    const start = new Date(earliestPurchaseDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  }, [earliestPurchaseDate]);

  const availablePeriods = useMemo(() => {
    return PROFIT_PERIODS.filter((period) => {
      if (period.id === 'year' && walletAgeInDays < 90) return false;
      if (period.id === 'month' && walletAgeInDays < 7) return false;
      return true;
    });
  }, [walletAgeInDays]);

  useEffect(() => {
    const currentIsAvailable = availablePeriods.find((p) => p.id === profitPeriod);
    if (!currentIsAvailable) {
      setProfitPeriod('total');
    }
  }, [availablePeriods, profitPeriod]);

  const periodStats = useMemo(() => {
    const profit = totalValue - totalInvested;
    const yieldVal = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    if (profitPeriod === 'total') {
      return { profit, yield: yieldVal, labelSuffix: '(Acumulado)' };
    }

    if (!earliestPurchaseDate) {
      return { profit: 0, yield: 0, labelSuffix: '(Sem data)' };
    }

    const diffDays = walletAgeInDays;

    let divider = 1;
    let suffix = '';

    if (profitPeriod === 'day') {
      divider = diffDays;
      suffix = '(Média/Dia)';
    } else if (profitPeriod === 'month') {
      divider = diffDays / 30;
      suffix = '(Média/Mês)';
    } else if (profitPeriod === 'year') {
      divider = diffDays / 365;
      suffix = '(Média/Ano)';
    }

    if (divider === 0) divider = 1;

    return {
      profit: profit / divider,
      yield: yieldVal / divider,
      labelSuffix: suffix,
    };
  }, [profitPeriod, totalValue, totalInvested, earliestPurchaseDate, walletAgeInDays]);

  if (loading) {
    return <WalletSkeleton />;
  }

  const showEmptyState = (positions.length === 0 && !loading) || debugShowEmpty;

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
