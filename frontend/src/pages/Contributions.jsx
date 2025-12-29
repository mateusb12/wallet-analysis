import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import {
  TrendingUp,
  Search,
  Clock,
  BarChart2,
  DollarSign,
  Percent,
  Activity,
  ChevronDown,
  Check,
  Layers,
  List,
  Tag,
} from 'lucide-react';
import { formatChartDate } from '../utils/dateUtils.js';
import { fetchB3Prices, fetchPriceClosestToDate } from '../services/b3service.js';

const getDetailedTimeElapsed = (dateString) => {
  if (!dateString) return { short: '-', long: '-' };
  const start = new Date(dateString);
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const partsShort = [];
  if (years > 0) partsShort.push(`${years}a`);
  if (months > 0) partsShort.push(`${months}m`);
  if (days > 0 && years === 0) partsShort.push(`${days}d`);
  else if (days > 0 && years > 0 && months === 0) partsShort.push(`${days}d`);

  if (partsShort.length === 0) return { short: 'Hoje', long: 'Menos de 24h' };

  return { short: partsShort.join(' '), long: '' };
};

const calculateEquivalentRate = (totalProfitPercent, tradeDate, mode) => {
  if (mode === 'total' || !totalProfitPercent) return totalProfitPercent;
  const start = new Date(tradeDate);
  const now = new Date();
  const diffTime = Math.abs(now - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return totalProfitPercent;

  const multiplier = 1 + totalProfitPercent / 100;
  let exponent = 1;
  if (mode === 'aa') exponent = 365 / diffDays;
  if (mode === 'am') exponent = 30 / diffDays;
  if (mode === 'ad') exponent = 1 / diffDays;

  const adjusted = Math.pow(multiplier, exponent) - 1;
  return adjusted * 100;
};

const getValueColor = (val) => {
  if (val > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (val < 0) return 'text-rose-600 dark:text-rose-400';
  return 'text-gray-600 dark:text-gray-400';
};

const getTypeColor = (type) => {
  switch (type) {
    case 'stock':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'fii':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'etf':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
};

export default function Contributions() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [performanceMode, setPerformanceMode] = useState('relative');

  const [rentabMode, setRentabMode] = useState('total');
  const [isRentabMenuOpen, setIsRentabMenuOpen] = useState(false);
  const rentabMenuRef = useRef(null);

  const [viewMode, setViewMode] = useState('flat');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    function handleClickOutside(event) {
      if (rentabMenuRef.current && !rentabMenuRef.current.contains(event.target)) {
        setIsRentabMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (user?.id) fetchPurchases();
  }, [user]);

  const fetchPurchases = async () => {
    try {
      const response = await fetch(`${API_URL}/wallet/purchases?user_id=${user.id}`);
      if (!response.ok) throw new Error('Falha ao buscar aportes');

      const data = await response.json();
      const uniqueTickers = [...new Set(data.map((item) => item.ticker))];

      const marketDataMap = {};
      const dateOneYearAgo = new Date();
      dateOneYearAgo.setFullYear(dateOneYearAgo.getFullYear() - 1);
      const dateOneYearAgoStr = dateOneYearAgo.toISOString().split('T')[0];

      await Promise.all(
        uniqueTickers.map(async (ticker) => {
          try {
            const { data: priceData } = await fetchB3Prices(ticker, 1, 1);
            const priceOld = await fetchPriceClosestToDate(ticker, dateOneYearAgoStr);
            if (priceData && priceData.length > 0) {
              marketDataMap[ticker] = {
                current: parseFloat(priceData[0].close),
                oneYearAgo: priceOld,
              };
            }
          } catch (err) {
            console.error(`Erro ao buscar dados de mercado para ${ticker}`, err);
          }
        })
      );

      const enrichedData = data.map((item) => {
        const marketData = marketDataMap[item.ticker];
        const currentPrice = marketData?.current || null;
        const priceOneYearAgo = marketData?.oneYearAgo || null;

        let profitValue = 0;
        let profitPercent = 0;
        let asset1YGrowth = null;

        if (currentPrice) {
          const totalPaid = Number(item.price) * Number(item.qty);
          const totalCurrent = currentPrice * Number(item.qty);
          profitValue = totalCurrent - totalPaid;
          profitPercent = ((currentPrice - Number(item.price)) / Number(item.price)) * 100;
          if (priceOneYearAgo) {
            asset1YGrowth = ((currentPrice - priceOneYearAgo) / priceOneYearAgo) * 100;
          }
        }

        return {
          ...item,
          currentPrice,
          priceOneYearAgo,
          asset1YGrowth,
          profitValue,
          profitPercent,
          hasPriceData: !!currentPrice,
        };
      });

      const sorted = enrichedData.sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));
      setPurchases(sorted);
    } catch (error) {
      console.error('Erro ao buscar aportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = purchases.filter((item) => {
    const matchesSearch =
      item.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const processedPurchases = filteredPurchases.map((item) => {
    const displayPercent = calculateEquivalentRate(item.profitPercent, item.trade_date, rentabMode);
    return { ...item, displayPercent };
  });

  const groupedData = useMemo(() => {
    if (viewMode === 'flat') return null;

    const groups = {};
    processedPurchases.forEach((item) => {
      if (!groups[item.ticker]) {
        groups[item.ticker] = {
          ticker: item.ticker,
          type: item.type,
          items: [],

          totalQty: 0,
          totalPaid: 0,
          totalCurrent: 0,
          totalProfit: 0,
        };
      }
      const g = groups[item.ticker];
      g.items.push(item);

      const paid = Number(item.price) * Number(item.qty);
      const current = item.hasPriceData ? Number(item.currentPrice) * Number(item.qty) : 0;

      g.totalQty += Number(item.qty);
      g.totalPaid += paid;
      g.totalCurrent += current;
      if (item.hasPriceData) {
        g.totalProfit += current - paid;
      }
    });

    return Object.keys(groups)
      .sort()
      .reduce((obj, key) => {
        obj[key] = groups[key];
        return obj;
      }, {});
  }, [processedPurchases, viewMode]);

  const maxAbsPercent = Math.max(
    0.1,
    ...processedPurchases.map((i) => Math.abs(i.displayPercent || 0))
  );

  const rentabOptions = {
    total: { label: 'Total', suffix: '' },
    aa: { label: 'Ao Ano', suffix: 'a.a.' },
    am: { label: 'Ao Mês', suffix: 'a.m.' },
    ad: { label: 'Ao Dia', suffix: 'a.d.' },
  };

  const assetPerformance = useMemo(() => {
    if (!purchases.length) return [];
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

  const ContributionRow = ({ item }) => {
    const timeData = getDetailedTimeElapsed(item.trade_date);
    const totalCurrentValue = item.hasPriceData
      ? Number(item.currentPrice) * Number(item.qty)
      : null;
    const totalPaidValue = Number(item.price) * Number(item.qty);
    const isSimpleProfit = totalCurrentValue >= totalPaidValue;
    const valAtualColor = isSimpleProfit
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
    const isDisplayProfit = (item.displayPercent || 0) >= 0;
    const rawPercent = item.hasPriceData ? item.displayPercent : 0;
    const absPercent = Math.abs(rawPercent);
    const barWidth = Math.min(100, (absPercent / maxAbsPercent) * 100);
    const barColorClass = isDisplayProfit
      ? 'bg-emerald-500 dark:bg-emerald-500'
      : 'bg-rose-500 dark:bg-rose-500';

    return (
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0">
        <td className="px-6 py-4 text-center whitespace-nowrap text-gray-600 dark:text-gray-300">
          {formatChartDate(item.trade_date)}
        </td>
        <td className="px-6 py-4 text-center font-bold text-gray-900 dark:text-white">
          {item.ticker}
        </td>
        <td className="px-6 py-4 text-center">
          <span
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getTypeColor(item.type)}`}
          >
            {item.type}
          </span>
        </td>
        <td className="px-6 py-4 text-center text-gray-900 dark:text-white font-mono">
          {item.qty}
        </td>
        <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300 font-mono">
          {Number(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </td>
        <td className="px-6 py-4 text-center font-medium text-gray-900 dark:text-white font-mono">
          {totalPaidValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </td>
        <td
          className={`px-6 py-4 text-center font-bold bg-gray-50/50 dark:bg-gray-800/50 border-l border-gray-100 dark:border-gray-700 font-mono ${item.hasPriceData ? valAtualColor : 'text-gray-400'}`}
        >
          {totalCurrentValue !== null
            ? totalCurrentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '-'}
        </td>
        <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 border-l border-gray-100 dark:border-gray-700 font-medium text-xs">
          {timeData.short}
        </td>
        <td
          className={`px-6 py-4 text-right font-bold font-mono ${getValueColor(item.profitValue)}`}
        >
          {item.hasPriceData
            ? item.profitValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '-'}
        </td>
        <td className="px-6 py-4 align-middle">
          {item.hasPriceData ? (
            <div className="flex items-center w-full gap-3">
              <div
                className={`w-16 text-right font-bold text-xs ${isDisplayProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
              >
                {isDisplayProfit ? '+' : ''}
                {rawPercent.toFixed(2)}%
              </div>
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex items-center">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColorClass}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-gray-400 text-xs text-center block">S/ Dados</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[90rem] mx-auto pb-20">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-green-600" /> Meus Aportes
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Histórico completo e análise de performance.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar ativo..."
              className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Todos os Tipos</option>
            <option value="stock">Ações</option>
            <option value="fii">FIIs</option>
            <option value="etf">ETFs</option>
          </select>

          <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-1">
            <button
              onClick={() => setViewMode('flat')}
              className={`p-1.5 rounded transition-all ${viewMode === 'flat' ? 'bg-gray-100 dark:bg-gray-700 text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Lista por Data"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-1.5 rounded transition-all ${viewMode === 'grouped' ? 'bg-gray-100 dark:bg-gray-700 text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Agrupar por Ativo"
            >
              <Layers size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-visible mb-8">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Calculando dados...</div>
        ) : (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-center">Data</th>
                  <th className="px-6 py-3 text-center">Ativo</th>
                  <th className="px-6 py-3 text-center">Tipo</th>
                  <th className="px-6 py-3 text-center">Qtd</th>
                  <th className="px-6 py-3 text-center">Preço Pago</th>
                  <th className="px-6 py-3 text-center">Total Pago</th>
                  <th className="px-6 py-3 text-center bg-gray-100/50 dark:bg-gray-700/70 border-l border-gray-200">
                    Valor Atual
                  </th>
                  <th className="px-6 py-3 text-center border-l border-gray-100">Tempo</th>
                  <th className="px-6 py-3 text-center">Rentab. (R$)</th>
                  <th
                    ref={rentabMenuRef}
                    className="px-6 py-3 text-left cursor-pointer hover:bg-gray-200/50 relative min-w-[220px]"
                    onClick={() => setIsRentabMenuOpen(!isRentabMenuOpen)}
                  >
                    <div className="flex items-center gap-1">
                      Rentab. ({rentabOptions[rentabMode].label}) <ChevronDown size={14} />
                    </div>
                    {isRentabMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border z-50">
                        {Object.keys(rentabOptions).map((key) => (
                          <div
                            key={key}
                            className="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRentabMode(key);
                              setIsRentabMenuOpen(false);
                            }}
                          >
                            {rentabOptions[key].label}{' '}
                            {rentabMode === key && <Check size={14} className="inline ml-2" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {viewMode === 'flat' ? (
                  processedPurchases.length > 0 ? (
                    processedPurchases.map((item) => <ContributionRow key={item.id} item={item} />)
                  ) : (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-gray-500">
                        Nenhum aporte.
                      </td>
                    </tr>
                  )
                ) : groupedData && Object.keys(groupedData).length > 0 ? (
                  Object.keys(groupedData).map((ticker) => {
                    const group = groupedData[ticker];
                    return (
                      <React.Fragment key={ticker}>
                        {}
                        <tr className="bg-gray-100 dark:bg-gray-900 border-y border-gray-300 dark:border-gray-600">
                          <td colSpan="10" className="px-6 py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Tag size={16} className="text-gray-500" />
                                <span className="font-bold text-base text-gray-800 dark:text-gray-100">
                                  {ticker}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${getTypeColor(group.type)}`}
                                >
                                  {group.type}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({group.items.length} aportes)
                                </span>
                              </div>
                              <div className="flex gap-6 text-xs font-mono text-gray-600 dark:text-gray-400">
                                <div>
                                  Qtd: <span className="font-bold">{group.totalQty}</span>
                                </div>
                                <div>
                                  Pago:{' '}
                                  <span className="font-bold">
                                    {group.totalPaid.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </span>
                                </div>
                                <div
                                  className={
                                    group.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                                  }
                                >
                                  Res:{' '}
                                  <span className="font-bold">
                                    {group.totalProfit.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {}
                        {group.items.map((item) => (
                          <ContributionRow key={item.id} item={item} />
                        ))}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="10" className="p-8 text-center text-gray-500">
                      Nenhum aporte.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {assetPerformance.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              Ranking de Performance (12m)
            </h3>
          </div>
          {}
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

              return (
                <div key={asset.ticker} className="flex items-center gap-4 text-sm group">
                  <div className="w-6 text-gray-400 font-mono text-xs">#{index + 1}</div>
                  <div className="w-16 font-bold text-gray-700 dark:text-gray-300">
                    {asset.ticker}
                  </div>
                  <div className="flex-1 h-8 bg-gray-50 dark:bg-gray-700/50 rounded overflow-hidden relative">
                    <div
                      className={`h-full ${isProfit ? 'bg-green-500/20 border-l-4 border-green-500' : 'bg-red-500/20 border-l-4 border-red-500'}`}
                      style={{ width: `${widthPercentage}%` }}
                    ></div>
                    <span className="absolute inset-0 flex items-center pl-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                      {formattedValue}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
