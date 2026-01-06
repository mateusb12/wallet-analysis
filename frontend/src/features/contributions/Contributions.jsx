import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { TrendingUp, Search, Layers, List, Tag, ChevronDown, Check, Copy } from 'lucide-react';
import { formatChartDate } from '../../utils/dateUtils.js';
import { fetchB3Prices, fetchPriceClosestToDate } from '../../services/b3service.js';
import { getDetailedTimeElapsed, getTypeColor } from './contributionUtils.js';
import AssetPerformanceChart from './ContributionPerformanceChart.jsx';
import { supabase } from '../../services/supabaseClient.js';

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

export default function Contributions() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.error('Token de autenticação não encontrado. Usuário não logado.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/wallet/purchases?user_id=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

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

            const priceOldAdjusted = await fetchPriceClosestToDate(ticker, dateOneYearAgoStr);

            if (priceData && priceData.length > 0) {
              marketDataMap[ticker] = {
                currentNominal: parseFloat(priceData[0].close),
                currentAdjusted: parseFloat(priceData[0].adjusted_close || priceData[0].close),
                oneYearAgoAdjusted: priceOldAdjusted,
              };
            }
          } catch (err) {
            console.error(`Erro ao buscar dados de mercado para ${ticker}`, err);
          }
        })
      );

      const enrichedData = data.map((item) => {
        const marketData = marketDataMap[item.ticker];
        const currentPrice = marketData?.currentNominal || null;
        const currentPriceAdj = marketData?.currentAdjusted || null;
        const priceOneYearAgoAdj = marketData?.oneYearAgoAdjusted || null;

        let profitValue = 0;
        let profitPercent = 0;
        let asset1YGrowth = null;

        if (currentPrice) {
          const totalPaid = Number(item.price) * Number(item.qty);
          const totalCurrent = currentPrice * Number(item.qty);

          profitValue = totalCurrent - totalPaid;

          profitPercent = ((currentPrice - Number(item.price)) / Number(item.price)) * 100;

          if (priceOneYearAgoAdj && currentPriceAdj) {
            asset1YGrowth = ((currentPriceAdj - priceOneYearAgoAdj) / priceOneYearAgoAdj) * 100;
          } else if (marketData?.oneYearAgoNominal) {
            asset1YGrowth =
              ((currentPrice - marketData.oneYearAgoNominal) / marketData.oneYearAgoNominal) * 100;
          }
        }

        return {
          ...item,
          currentPrice,
          priceOneYearAgo: priceOneYearAgoAdj,
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

  const handleCopyDebug = () => {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      totalRecords: purchases.length,

      structureSample: purchases.length > 0 ? purchases[0] : null,

      data: purchases,
    };

    navigator.clipboard
      .writeText(JSON.stringify(debugInfo, null, 2))
      .then(() => alert('Dados copiados! Cole no chat.'))
      .catch((err) => console.error('Erro ao copiar:', err));
  };

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
          <button
            onClick={handleCopyDebug}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors shadow-sm"
            title="Copiar JSON para Debug"
          >
            <Copy size={16} />
            <span className="hidden sm:inline">Debug</span>
          </button>
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
          <div className="overflow-auto max-h-[75vh] relative scroll-smooth">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 z-20 text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
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

      <AssetPerformanceChart purchases={purchases} />
    </div>
  );
}
