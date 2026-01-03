import { useState, useEffect, useMemo } from 'react';
import {
  fetchWalletPositions,
  fetchWalletPerformanceHistory,
  fetchSpecificAssetHistory,
} from '../../services/walletDataService.js';
import { fetchB3Prices } from '../../services/b3service.js';
import { classifyAsset } from '../balancing/balancingUtils.js';

export const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';
import iconTotal from '../../assets/all.png';

export const CATEGORIES_CONFIG = {
  total: { label: 'Visão Geral', benchmark: 'CDI', icon: iconTotal },
  stock: { label: 'Ações', benchmark: 'IBOV', icon: iconStocks },
  etf: { label: 'ETFs', benchmark: 'S&P 500', icon: iconEtf },
  fii: { label: 'FIIs', benchmark: 'IFIX', icon: iconFiis },
};

export const TIME_RANGES = [
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useWalletDashboardData = (user) => {
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
  const [assetsHistoryMap, setAssetsHistoryMap] = useState({});
  const [debugShowEmpty, setDebugShowEmpty] = useState(false);

  useEffect(() => {
    const consolidatePositions = (rawData) => {
      const map = {};
      rawData.forEach((item) => {
        const itemPrice = item.purchase_price || item.price || 0;
        if (map[item.ticker]) {
          const existing = map[item.ticker];
          const totalQty = existing.qty + item.qty;
          const totalCost = existing.purchase_price * existing.qty + itemPrice * item.qty;
          map[item.ticker] = {
            ...existing,
            qty: totalQty,
            purchase_price: totalCost / totalQty,
            trade_date:
              new Date(existing.trade_date) < new Date(item.trade_date)
                ? existing.trade_date
                : item.trade_date,
          };
        } else {
          map[item.ticker] = { ...item, purchase_price: itemPrice };
        }
      });
      return Object.values(map);
    };

    const loadData = async () => {
      if (!user?.id) return;
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
            if (!purchasesMap[move.ticker]) purchasesMap[move.ticker] = [];
            purchasesMap[move.ticker].push(move);
          });
          Object.keys(purchasesMap).forEach((ticker) => {
            purchasesMap[ticker].sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));
          });
        }
        setAssetsHistoryMap(purchasesMap);

        const uniqueAssets = consolidatePositions(posData);
        const positionsWithRealPrices = await Promise.all(
          uniqueAssets.map(async (p) => {
            try {
              const { data } = await fetchB3Prices(p.ticker, 1, 1);
              let currentPrice = p.purchase_price;
              let priceSource = 'compra';

              if (data && data.length > 0) {
                currentPrice = parseFloat(data[0].close);
                priceSource = 'b3_real';
              }

              const cls = await classifyAsset(p.ticker);
              let specificType = 'Indefinido';

              if (p.type === 'fii' || cls.detected_type?.includes('FII')) {
                const sectorStr = cls.sector || 'Indefinido';
                if (
                  sectorStr &&
                  sectorStr.toLowerCase() !== 'outros' &&
                  sectorStr !== 'Indefinido'
                ) {
                  specificType = sectorStr
                    .split(' ')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                    .join(' ');
                } else {
                  specificType = cls.detected_type?.includes('Tijolo') ? 'Tijolo' : 'Papel';
                }
              }

              return {
                ...p,
                current_price: currentPrice,
                total_value_current: currentPrice * p.qty,
                price_source: priceSource,
                asset_subtype: specificType,
              };
            } catch (err) {
              console.error(`Erro ao buscar preço para ${p.ticker}`, err);
              return {
                ...p,
                current_price: p.purchase_price,
                total_value_current: p.purchase_price * p.qty,
                price_source: 'erro_fallback',
                asset_subtype: 'Indefinido',
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
  }, [user?.id]);

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
    let relevantTransactions = [];
    let targetTickers = [];
    if (selectedAssetTicker) {
      targetTickers = [selectedAssetTicker];
    } else {
      targetTickers = filteredPositions.map((p) => p.ticker);
    }
    targetTickers.forEach((ticker) => {
      const history = assetsHistoryMap[ticker] || [];
      relevantTransactions = [...relevantTransactions, ...history];
    });
    return relevantTransactions.map((t) => ({
      ...t,
      purchaseDate: t.trade_date,
      purchase_price: t.price !== undefined ? t.price : t.purchase_price || 0,
    }));
  }, [selectedAssetTicker, filteredPositions, assetsHistoryMap]);

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

  const showEmptyState = (positions.length === 0 && !loading) || debugShowEmpty;

  return {
    activeTab,
    allocationView,
    timeRange,
    selectedAssetTicker,
    loading,
    loadingSpecific,
    dataWarnings,
    profitPeriod,
    highlightedDate,
    debugShowEmpty,

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

    setActiveTab,
    setAllocationView,
    setTimeRange,
    setSelectedAssetTicker,
    setProfitPeriod,
    setHighlightedDate,
    setDebugShowEmpty,
  };
};
