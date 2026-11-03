import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  fetchDashboardData,
  WALLET_DASHBOARD_QUERY_KEY,
} from '../../services/walletDataService.js';
import { formatElapsedPeriod } from '../../utils/dateUtils.js';

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';
import iconTotal from '../../assets/all.png';

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
  const [activeTab, setActiveTab] = useState('total');
  const [allocationView, setAllocationView] = useState('specific');
  const [timeRange, setTimeRange] = useState('DEFAULT');
  const [selectedAssetTicker, setSelectedAssetTicker] = useState('');
  const [profitPeriod, setProfitPeriod] = useState('total');

  const [apiDebug, setApiDebug] = useState(null);
  const [highlightedDate, setHighlightedDate] = useState(null);
  const [debugShowEmpty, setDebugShowEmpty] = useState(false);

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: [WALLET_DASHBOARD_QUERY_KEY, user?.id],
    queryFn: fetchDashboardData,
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    if (data) {
      setApiDebug({
        url: 'walletDataService > /wallet/dashboard',
        status: 200,
        rawResponse: data,
      });
    }
  }, [data]);

  useEffect(() => {
    if (error) console.error('Falha na conexão:', error);
  }, [error]);

  const loading = isPending && !data;

  const safeData = useMemo(() => {
    const defaultStats = { profit: 0, yield: 0, valuation: 0, dividends: 0 };
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
      invested_by_type: { stock: 0, fii: 0, etf: 0 },
    };

    const adaptedPositions = raw.positions.map((p) => {
      let mappedSubtype = 'Indefinido';
      if (p.sector && p.sector !== 'Outros' && p.sector !== 'erro') {
        if (['fundos de fundos', 'híbrido', 'multiestratégia'].includes(p.sector.toLowerCase())) {
          mappedSubtype = 'Outros';
        } else {
          mappedSubtype = p.sector.charAt(0).toUpperCase() + p.sector.slice(1);
        }
      }

      let fullTypeRaw = p.subtype || mappedSubtype;

      if (!fullTypeRaw || typeof fullTypeRaw !== 'string') {
        fullTypeRaw = 'Indefinido';
      }

      let cleanFullType = fullTypeRaw.replace(/^FII\s-\s/, '');

      return {
        ...p,
        total_value_current: p.total_value,
        purchase_price: p.avg_price,
        asset_subtype: mappedSubtype,
        full_type: cleanFullType,
      };
    });

    return { ...raw, positions: adaptedPositions };
  }, [data]);

  const filteredPositions = useMemo(() => {
    if (activeTab === 'total') return safeData.positions;
    return safeData.positions.filter((p) => p.type === activeTab);
  }, [safeData, activeTab]);

  const dashboardStats = useMemo(() => {
    const categoryProjections =
      safeData.period_projections?.[activeTab] || safeData.period_projections?.total;

    const stats = categoryProjections?.[profitPeriod] || {
      profit: 0,
      yield: 0,
      valuation: 0,
      dividends: 0,
    };

    let current = 0;
    let invested = 0;

    if (activeTab === 'total') {
      current = safeData.summary.total_current;
      invested = safeData.summary.total_invested;
    } else {
      current = safeData.allocation[activeTab] || 0;
      invested = safeData.invested_by_type?.[activeTab] || 0;
    }

    const relevantTransactions = (safeData.transactions || []).filter(
      (transaction) =>
        activeTab === 'total' || (transaction.asset_type || transaction.type) === activeTab
    );
    const earliestPurchaseDate = relevantTransactions
      .map((transaction) => transaction.trade_date)
      .filter(Boolean)
      .sort()[0];

    const labels = {
      total: `(${formatElapsedPeriod(earliestPurchaseDate)})`,
      day: '(Média por Dia)',
      month: '(Média por Mês)',
      year: '(Projeção Anual)',
    };

    const numericInvested = Number(invested) || 0;
    const numericProfit = Number(stats.profit) || 0;
    const numericDividends = Number(stats.dividends) || 0;
    const numericValuation = Number.isFinite(Number(stats.valuation))
      ? Number(stats.valuation)
      : numericProfit - numericDividends;

    return {
      invested: numericInvested,
      current,
      profit: numericProfit,
      yield: Number(stats.yield) || 0,
      valuation: numericValuation,
      dividends: numericDividends,
      valuationPercent: numericInvested > 0 ? (numericValuation / numericInvested) * 100 : 0,
      dividendsPercent: numericInvested > 0 ? (numericDividends / numericInvested) * 100 : 0,
      labelSuffix: labels[profitPeriod],
    };
  }, [safeData, activeTab, profitPeriod]);

  const categoryProfitability = useMemo(() => {
    return ['stock', 'etf', 'fii'].map((type) => {
      const stats = safeData.period_projections?.[type]?.[profitPeriod] || {};
      return {
        type,
        label: CATEGORIES_CONFIG[type].label,
        totalValue: Number(stats.profit) || 0,
        valuationValue: Number(stats.valuation) || 0,
        dividendsValue: Number(stats.dividends) || 0,
        yield: Number(stats.yield) || 0,
        valuationPercent:
          Number(safeData.invested_by_type?.[type]) > 0
            ? ((Number(stats.valuation) || 0) / Number(safeData.invested_by_type[type])) * 100
            : 0,
        dividendsPercent:
          Number(safeData.invested_by_type?.[type]) > 0
            ? ((Number(stats.dividends) || 0) / Number(safeData.invested_by_type[type])) * 100
            : 0,
      };
    });
  }, [safeData, profitPeriod]);

  const topImpactAssets = useMemo(() => {
    const positionByTicker = new Map(
      safeData.positions.map((position) => [position.ticker, position])
    );
    const impactByTicker = (safeData.transactions || [])
      .filter(
        (transaction) =>
          activeTab === 'total' || (transaction.asset_type || transaction.type) === activeTab
      )
      .reduce((assets, transaction) => {
        const ticker = transaction.ticker;
        if (!assets[ticker]) assets[ticker] = { invested: 0, valuation: 0, dividends: 0 };
        assets[ticker].invested +=
          (Number(transaction.price) || 0) * (Number(transaction.qty) || 0);
        assets[ticker].valuation += Number(transaction.valuation_value) || 0;
        assets[ticker].dividends += Number(transaction.dividend_value) || 0;
        return assets;
      }, {});

    return Object.entries(impactByTicker)
      .map(([ticker, values]) => ({
        ticker,
        label: ticker,
        name: positionByTicker.get(ticker)?.name || ticker,
        age: positionByTicker.get(ticker)?.age,
        totalReturn: values.valuation + values.dividends,
        totalValue: values.valuation + values.dividends,
        valuationValue: values.valuation,
        dividendsValue: values.dividends,
        yield:
          values.invested > 0 ? ((values.valuation + values.dividends) / values.invested) * 100 : 0,
        valuationPercent: values.invested > 0 ? (values.valuation / values.invested) * 100 : 0,
        dividendsPercent: values.invested > 0 ? (values.dividends / values.invested) * 100 : 0,
      }))
      .sort((a, b) => b.totalReturn - a.totalReturn);
  }, [safeData, activeTab]);

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
  const earliestPurchaseDate =
    safeData.transactions
      .map((transaction) => transaction.trade_date)
      .filter(Boolean)
      .sort()[0] || null;

  const chartHistory = selectedAssetTicker
    ? safeData.history_by_ticker?.[selectedAssetTicker] || []
    : activeTab === 'total'
      ? safeData.history
      : safeData.history_by_type?.[activeTab] || [];

  const assetsHistoryMap = useMemo(() => {
    return (safeData.transactions || []).reduce((historyByTicker, transaction) => {
      const ticker = transaction.ticker;
      if (!ticker) return historyByTicker;

      if (!historyByTicker[ticker]) historyByTicker[ticker] = [];
      historyByTicker[ticker].push({
        ...transaction,
        type: transaction.asset_type || transaction.type,
      });
      return historyByTicker;
    }, {});
  }, [safeData.transactions]);

  const chartEarliestPurchaseDate =
    safeData.transactions
      .filter((transaction) => activeTab === 'total' || transaction.type === activeTab)
      .map((transaction) => transaction.trade_date)
      .filter(Boolean)
      .sort()[0] || null;

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
    loadingSpecific: isFetching && Boolean(data),
    apiDebug,
    profitPeriod,
    highlightedDate,
    debugShowEmpty,

    totalInvested: dashboardStats.invested,
    totalValue: dashboardStats.current,

    periodStats: {
      profit: dashboardStats.profit,
      valuation: dashboardStats.valuation,
      yield: dashboardStats.yield,
      valuationPercent: dashboardStats.valuationPercent,
      dividendsPercent: dashboardStats.dividendsPercent,
      dividends: dashboardStats.dividends,
      labelSuffix: dashboardStats.labelSuffix,
    },
    categoryProfitability,
    topImpactAssets,

    positions: safeData.positions,
    filteredPositions,

    categoryTotals: {
      stock: safeData.allocation.stock,
      fii: safeData.allocation.fii,
      etf: safeData.allocation.etf,
      total: safeData.summary.total_current,
    },

    currentPieData,
    displayedHistory: chartHistory,
    chartEvents,

    availablePeriods: PROFIT_PERIODS,
    earliestPurchaseDate: chartEarliestPurchaseDate,
    showEmptyState,
    dataWarnings: [],
    assetsHistoryMap,
    transactionsMap: {},
  };
};
