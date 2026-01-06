import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';
import iconTotal from '../../assets/all.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

export const CATEGORIES_CONFIG = {
  total: { label: 'Visão Geral', benchmark: 'CDI', icon: iconTotal },
  stock: { label: 'Ações', benchmark: 'IBOV', icon: iconStocks },
  etf: { label: 'ETFs', benchmark: 'S&P 500', icon: iconEtf },
  fii: { label: 'FIIs', benchmark: 'IFIX', icon: iconFiis },
};

export const TIME_RANGES = [
  { id: 'DEFAULT', label: 'Desde Início' },
  { id: 'YTD', label: 'Ano Atual' },
  { id: 'MAX', label: 'Max' },
];

export const PROFIT_PERIODS = [
  { id: 'total', label: 'Total (Acumulado)' },
  { id: 'day', label: 'Média por Dia' },
  { id: 'month', label: 'Média por Mês' },
  { id: 'year', label: 'Média por Ano (Projeção)' },
];

export const useWalletDashboardData = (user) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('total');
  const [allocationView, setAllocationView] = useState('specific');
  const [timeRange, setTimeRange] = useState('DEFAULT');
  const [selectedAssetTicker, setSelectedAssetTicker] = useState('');
  const [profitPeriod, setProfitPeriod] = useState('total');

  const [apiDebug, setApiDebug] = useState(null);
  const [highlightedDate, setHighlightedDate] = useState(null);
  const [debugShowEmpty, setDebugShowEmpty] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/wallet/dashboard?user_id=${user.id}`);
        const result = await response.json();

        if (response.ok) {
          setData(result);
          setApiDebug({
            url: `${API_URL}/wallet/dashboard`,
            status: response.status,
            rawResponse: result,
          });
        }
      } catch (error) {
        console.error('Falha na conexão:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const safeData = useMemo(() => {
    const defaultStats = { profit: 0, yield: 0 };
    const defaultProjections = {
      total: defaultStats,
      day: defaultStats,
      month: defaultStats,
      year: defaultStats,
    };

    const raw = data || {
      summary: { total_invested: 0, total_current: 0, total_profit: 0, total_profit_percent: 0 },

      period_projections: {
        total: defaultProjections,
        stock: defaultProjections,
        fii: defaultProjections,
        etf: defaultProjections,
      },
      positions: [],
      history: [],
      transactions: [],
      allocation: { stock: 0, fii: 0, etf: 0 },
    };

    const adaptedPositions = raw.positions.map((p) => ({
      ...p,
      total_value_current: p.total_value,
      purchase_price: p.avg_price,
    }));

    return { ...raw, positions: adaptedPositions };
  }, [data]);

  const filteredPositions = useMemo(() => {
    if (activeTab === 'total') return safeData.positions;
    return safeData.positions.filter((p) => p.type === activeTab);
  }, [safeData, activeTab]);

  const dashboardStats = useMemo(() => {
    const categoryProjections =
      safeData.period_projections?.[activeTab] || safeData.period_projections?.total;

    const stats = categoryProjections?.[profitPeriod] || { profit: 0, yield: 0 };

    let current = 0;
    let invested = 0;

    if (activeTab === 'total') {
      current = safeData.summary.total_current;
      invested = safeData.summary.total_invested;
    } else {
      current = safeData.allocation[activeTab] || 0;

      const totalCategoryProfit = categoryProjections?.total?.profit || 0;
      invested = current - totalCategoryProfit;
    }

    const labels = {
      total: '(Acumulado)',
      day: '(Média por Dia)',
      month: '(Média por Mês)',
      year: '(Projeção Anual)',
    };

    return {
      invested,
      current,
      profit: stats.profit,
      yield: stats.yield,
      labelSuffix: labels[profitPeriod],
    };
  }, [safeData, activeTab, profitPeriod]);

  const currentPieData = useMemo(() => {
    if (activeTab === 'total' && allocationView === 'general') {
      const { stock, fii, etf } = safeData.allocation;
      return [
        { name: 'Ações', value: stock, color: '#3b82f6' },
        { name: 'FIIs', value: fii, color: '#10b981' },
        { name: 'ETFs', value: etf, color: '#f59e0b' },
      ].filter((i) => i.value > 0);
    }

    return filteredPositions.map((pos, idx) => ({
      ...pos,
      name: pos.ticker,
      value: pos.total_value_current,
      color: COLORS[idx % COLORS.length],
    }));
  }, [safeData, activeTab, allocationView, filteredPositions]);

  const chartEvents = useMemo(() => {
    if (!safeData.transactions) return [];

    let relevantTransactions = safeData.transactions;
    if (selectedAssetTicker) {
      relevantTransactions = relevantTransactions.filter((t) => t.ticker === selectedAssetTicker);
    } else if (activeTab !== 'total') {
      const tickersInTab = new Set(filteredPositions.map((p) => p.ticker));
      relevantTransactions = relevantTransactions.filter((t) => tickersInTab.has(t.ticker));
    }

    return relevantTransactions.map((t) => ({
      ...t,
      purchaseDate: t.trade_date,
      purchase_price: t.price,
    }));
  }, [safeData, selectedAssetTicker, activeTab, filteredPositions]);

  const showEmptyState = (safeData.positions.length === 0 && !loading) || debugShowEmpty;

  return {
    setActiveTab,
    setAllocationView,
    setTimeRange,
    setSelectedAssetTicker,
    setProfitPeriod,
    setHighlightedDate,
    setDebugShowEmpty,

    activeTab,
    allocationView,
    timeRange,
    selectedAssetTicker,
    loading,
    loadingSpecific: false,
    apiDebug,
    profitPeriod,
    highlightedDate,
    debugShowEmpty,

    totalInvested: dashboardStats.invested,
    totalValue: dashboardStats.current,

    periodStats: {
      profit: dashboardStats.profit,
      yield: dashboardStats.yield,
      labelSuffix: dashboardStats.labelSuffix,
    },

    positions: safeData.positions,
    filteredPositions,

    categoryTotals: {
      stock: safeData.allocation.stock,
      fii: safeData.allocation.fii,
      etf: safeData.allocation.etf,
      total: safeData.summary.total_current,
    },

    currentPieData,
    displayedHistory: safeData.history,
    chartEvents,

    availablePeriods: PROFIT_PERIODS,
    earliestPurchaseDate: safeData.history.length > 0 ? safeData.history[0].trade_date : null,
    showEmptyState,
    dataWarnings: [],
    assetsHistoryMap: {},
    transactionsMap: {},
  };
};
