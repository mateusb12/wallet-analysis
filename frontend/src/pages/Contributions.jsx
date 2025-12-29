import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import {
  TrendingUp,
  Search,
  ArrowUp,
  ArrowDown,
  Clock,
  BarChart2,
  DollarSign,
  Percent,
  Activity,
  ChevronDown,
  Check,
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
  const partsLong = [];

  if (years > 0) {
    partsShort.push(`${years}a`);
    partsLong.push(`${years} ano${years > 1 ? 's' : ''}`);
  }
  if (months > 0) {
    partsShort.push(`${months}m`);
    partsLong.push(`${months} mês${months !== 1 ? 'es' : ''}`);
  }
  if (days > 0 && years === 0) {
    partsShort.push(`${days}d`);
    partsLong.push(`${days} dia${days > 1 ? 's' : ''}`);
  } else if (days > 0 && years > 0 && months === 0) {
    partsShort.push(`${days}d`);
    partsLong.push(`${days} dia${days > 1 ? 's' : ''}`);
  }

  if (partsShort.length === 0) return { short: 'Hoje', long: 'Menos de 24h' };

  let longString = '';
  if (partsLong.length > 1) {
    const last = partsLong.pop();
    longString = partsLong.join(', ') + ' e ' + last;
  } else {
    longString = partsLong[0];
  }

  return {
    short: partsShort.join(' '),
    long: longString,
  };
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

      const sorted = enrichedData.sort((a, b) => {
        const dateA = new Date(a.trade_date);
        const dateB = new Date(b.trade_date);
        return dateB - dateA;
      });

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
      const currentItemDate = new Date(item.trade_date);
      const storedDate = new Date(aggregation[item.ticker].firstTradeDate);
      if (currentItemDate < storedDate) {
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
      .sort((a, b) => {
        if (performanceMode === 'relative') return b.totalYieldPercent - a.totalYieldPercent;
        return b.totalProfit - a.totalProfit;
      });
  }, [purchases, performanceMode]);

  const maxValue = useMemo(() => {
    if (!assetPerformance.length) return 0;
    if (performanceMode === 'relative') {
      return Math.max(...assetPerformance.map((a) => Math.abs(a.totalYieldPercent)));
    }
    return Math.max(...assetPerformance.map((a) => Math.abs(a.totalProfit)));
  }, [assetPerformance, performanceMode]);

  return (
    <div className="p-4 md:p-8 max-w-[90rem] mx-auto pb-20">
      {}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-green-600" />
            Meus Aportes
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Histórico completo e análise de performance vs. mercado.
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
        </div>
      </div>

      {}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-visible mb-8">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Calculando rentabilidade e dados históricos...
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 font-medium text-center">Data</th>
                  <th className="px-6 py-3 font-medium text-center">Ativo</th>
                  <th className="px-6 py-3 font-medium text-center">Tipo</th>
                  <th className="px-6 py-3 font-medium text-center">Qtd</th>
                  <th className="px-6 py-3 font-medium text-center">Preço Pago</th>
                  <th className="px-6 py-3 font-medium text-center">Total Pago</th>
                  <th className="px-6 py-3 font-medium text-center bg-gray-100/50 dark:bg-gray-700/70 border-l border-gray-200 dark:border-gray-600">
                    Valor Atual
                  </th>
                  <th className="px-6 py-3 font-medium text-center border-l border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" /> Tempo
                    </div>
                  </th>
                  <th className="px-6 py-3 font-medium text-center">Rentab. (R$)</th>

                  {}
                  <th
                    ref={rentabMenuRef}
                    className="px-6 py-3 font-medium text-center cursor-pointer hover:bg-gray-200/50 dark:hover:bg-gray-600/50 transition-colors relative"
                    onClick={() => setIsRentabMenuOpen(!isRentabMenuOpen)}
                  >
                    <div className="flex items-center justify-center gap-1 text-gray-700 dark:text-gray-200">
                      Rentab. ({rentabOptions[rentabMode].label})
                      <ChevronDown
                        size={14}
                        className={`transform transition-transform ${isRentabMenuOpen ? 'rotate-180' : ''}`}
                      />
                    </div>

                    {}
                    {isRentabMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                        {Object.keys(rentabOptions).map((key) => (
                          <div
                            key={key}
                            className={`px-4 py-2.5 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                              rentabMode === key
                                ? 'text-green-600 bg-green-50 dark:bg-green-900/10'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRentabMode(key);
                              setIsRentabMenuOpen(false);
                            }}
                          >
                            <span>{rentabOptions[key].label}</span>
                            {rentabMode === key && <Check size={14} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPurchases.length > 0 ? (
                  filteredPurchases.map((item) => {
                    const isProfit = item.profitValue >= 0;
                    const colorClass = isProfit
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400';
                    const bgClass = isProfit
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20';
                    const timeData = getDetailedTimeElapsed(item.trade_date);
                    const totalCurrentValue = item.hasPriceData
                      ? Number(item.currentPrice) * Number(item.qty)
                      : null;

                    const displayPercent = calculateEquivalentRate(
                      item.profitPercent,
                      item.trade_date,
                      rentabMode
                    );
                    const isDisplayProfit = displayPercent >= 0;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
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
                        <td className="px-6 py-4 text-center text-gray-900 dark:text-white">
                          {item.qty}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300">
                          {Number(item.price).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-gray-900 dark:text-white">
                          {(Number(item.price) * Number(item.qty)).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td
                          className={`px-6 py-4 text-center font-bold bg-gray-50/50 dark:bg-gray-800/50 border-l border-gray-100 dark:border-gray-700 ${item.hasPriceData ? colorClass : 'text-gray-800 dark:text-gray-100'}`}
                        >
                          {totalCurrentValue !== null ? (
                            totalCurrentValue.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td
                          className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 border-l border-gray-100 dark:border-gray-700 font-medium text-xs cursor-help"
                          title={timeData.long}
                        >
                          {timeData.short}
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${colorClass}`}>
                          {item.hasPriceData ? (
                            item.profitValue.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>

                        {}
                        <td className="px-6 py-4 text-center relative">
                          {item.hasPriceData ? (
                            <div
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${isDisplayProfit ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}
                            >
                              {isDisplayProfit ? (
                                <ArrowUp className="w-3 h-3 mr-1" />
                              ) : (
                                <ArrowDown className="w-3 h-3 mr-1" />
                              )}
                              {displayPercent.toFixed(2)}%{' '}
                              <span className="text-[9px] ml-1 opacity-70">
                                {rentabOptions[rentabMode].suffix}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">S/ Dados</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="11"
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      Nenhum aporte encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {}
      {assetPerformance.length > 0 && (
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
              const hasBenchmark =
                asset.asset1YGrowth !== null && asset.asset1YGrowth !== undefined;

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
      )}
    </div>
  );
}
