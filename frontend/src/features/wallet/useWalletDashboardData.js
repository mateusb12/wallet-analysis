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

const calculateDetailedAge = (startDateStr) => {
  if (!startDateStr) return '';
  const start = new Date(startDateStr);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  const parts = [];
  if (years > 0) parts.push(`${years}a`);
  if (months > 0) parts.push(`${months}m`);
  if (days > 0) parts.push(`${days}d`);
  return parts.length > 0 ? parts.join(' ') : '0d';
};

const normalizeHistory = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    let val =
      item.asset_price_raw ??
      item.close ??
      item.adjusted_close ??
      item.price ??
      item.value ??
      item.valor ??
      0;
    let finalValue = parseFloat(val);
    if (isNaN(finalValue)) finalValue = 0;
    return {
      ...item,
      close: finalValue,
      trade_date: item.trade_date || item.date,
    };
  });
};

const processBenchmarkData = (data) => {
  if (!data || data.length === 0) return [];
  if (data[0].close > 1 || data[0].adjusted_close > 1) return normalizeHistory(data);
  let accumulated = 100.0;
  return data.map((item) => {
    const rawRate = item.value ?? item.close ?? 0;
    const rate = parseFloat(rawRate);
    accumulated = accumulated * (1 + rate / 100);
    return {
      trade_date: item.trade_date || item.date,
      close: accumulated,
      adjusted_close: accumulated,
      original_rate: rate,
    };
  });
};

export const useWalletDashboardData = (user) => {
  const [positions, setPositions] = useState([]);
  const [fullHistoryData, setFullHistoryData] = useState([]);
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
  const [transactionsMap, setTransactionsMap] = useState({});
  const [debugShowEmpty, setDebugShowEmpty] = useState(false);
  const [apiDebug, setApiDebug] = useState(null);

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
      console.log('🔄 Iniciando carga de dados. User ID:', user?.id);
      if (!user?.id) {
        console.warn('⚠️ User ID indefinido. Abortando carga.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const histDataResponse = await fetchWalletPerformanceHistory(user.id);

        if (histDataResponse.debug) {
          setApiDebug(histDataResponse.debug);
        }
        const [posData, histData, purchasesResponse] = await Promise.all([
          fetchWalletPositions(),

          fetchWalletPerformanceHistory(user.id),
          fetch(`${API_URL}/wallet/purchases?user_id=${user.id}`),
        ]);

        console.log('📦 Dados recebidos:', {
          posDataLength: posData?.length,
          histDataLength: histData?.length,
          histDataRaw: histData,
        });

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
        setTransactionsMap(purchasesMap);

        const uniqueAssets = consolidatePositions(posData);

        const positionsWithRealPrices = await Promise.all(
          uniqueAssets.map(async (p) => {
            try {
              const { data } = await fetchB3Prices(p.ticker, 1, 1);
              let currentPrice = p.purchase_price;
              let priceSource = 'compra';

              if (data && data.length > 0) {
                const rawPrice =
                  data[0].close ?? data[0].adjusted_close ?? data[0].price ?? data[0].value;
                if (rawPrice) {
                  currentPrice = parseFloat(rawPrice);
                  priceSource = 'b3_real';
                }
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

        if (histData && histData.total && Array.isArray(histData.total)) {
          setFullHistoryData(histData.total);
        } else if (Array.isArray(histData)) {
          setFullHistoryData(histData);
        } else {
          setFullHistoryData([]);
        }

        try {
          const cdiData = await fetchSpecificAssetHistory('CDI', 999);
          const processedCDI = processBenchmarkData(cdiData);
          setAssetsHistoryMap({ CDI: processedCDI });
        } catch (e) {
          console.warn('CDI Fetch falhou, usando fallback local se necessario');
        }

        if (histData.warnings) setDataWarnings(histData.warnings);
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
        if (selectedAssetTicker === 'CDI') {
          setSpecificAssetHistory(processBenchmarkData(data));
        } else {
          setSpecificAssetHistory(normalizeHistory(data));
        }
      } catch (error) {
        console.error('Failed fetch specific', error);
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
    return selectedAssetTicker
      ? filteredPositions.filter((p) => p.ticker === selectedAssetTicker)
      : filteredPositions;
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
    let targetTickers = selectedAssetTicker
      ? [selectedAssetTicker]
      : filteredPositions.map((p) => p.ticker);
    targetTickers.forEach((ticker) => {
      const history = transactionsMap[ticker] || [];
      relevantTransactions = [...relevantTransactions, ...history];
    });
    return relevantTransactions.map((t) => ({
      ...t,
      purchaseDate: t.trade_date,
      purchase_price: t.price !== undefined ? t.price : t.purchase_price || 0,
    }));
  }, [selectedAssetTicker, filteredPositions, transactionsMap]);

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
    let rawData = [];

    if (selectedAssetTicker) {
      rawData = specificAssetHistory;
    } else {
      rawData = Array.isArray(fullHistoryData) ? fullHistoryData : [];
    }

    if (rawData.length === 0) return [];

    let filteredData = rawData;
    const anchorDateString = earliestPurchaseDate;
    if (anchorDateString && filteredData.length > 0) {
      const purchaseDateObj = new Date(anchorDateString);
      const rangeConfig = TIME_RANGES.find((r) => r.id === timeRange);
      if (timeRange !== 'MAX') {
        let startDate = new Date(purchaseDateObj);
        if (rangeConfig && rangeConfig.offsetMonths > 0) {
          startDate.setMonth(startDate.getMonth() - rangeConfig.offsetMonths);
        }
        filteredData = rawData.filter((item) => new Date(item.trade_date) >= startDate);
      }
    }

    return filteredData.map((item) => {
      if (!selectedAssetTicker && item.portfolio_value !== undefined) {
        return item;
      }

      const asset = positions.find((p) => p.ticker === selectedAssetTicker);
      const qty = asset ? asset.qty : 1;
      const pVal = (item.close || 0) * qty;

      let bVal = item.benchmark_value || 0;
      if (!bVal) {
        const globalCDI = assetsHistoryMap['CDI'] || [];
        const match = globalCDI.find((b) => b.trade_date === item.trade_date);
        const firstItem = filteredData[0];
        const startCDI =
          globalCDI.find((b) => b.trade_date === firstItem?.trade_date)?.close || 100;
        const startVal = (firstItem?.close || 0) * qty;

        if (match && startCDI > 0 && startVal > 0) {
          bVal = (match.close / startCDI) * startVal;
        } else if (match) {
          bVal = match.close;
        }
      }

      return {
        ...item,
        portfolio_value: pVal,
        benchmark_value: bVal,
      };
    });
  }, [
    fullHistoryData,
    activeTab,
    timeRange,
    selectedAssetTicker,
    specificAssetHistory,
    earliestPurchaseDate,
    assetsHistoryMap,
    positions,
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
    const diffTime = Math.abs(new Date() - new Date(earliestPurchaseDate));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  }, [earliestPurchaseDate]);

  const availablePeriods = useMemo(() => {
    const ageString = calculateDetailedAge(earliestPurchaseDate);
    return PROFIT_PERIODS.filter((period) => {
      if (period.id === 'year' && walletAgeInDays < 90) return false;
      if (period.id === 'month' && walletAgeInDays < 7) return false;
      return true;
    }).map((period) => {
      if (period.id === 'total') {
        return {
          ...period,
          label: earliestPurchaseDate ? `Acumulado (${ageString})` : 'Total (Acumulado)',
        };
      }
      return period;
    });
  }, [walletAgeInDays, earliestPurchaseDate]);

  useEffect(() => {
    if (!availablePeriods.find((p) => p.id === profitPeriod)) setProfitPeriod('total');
  }, [availablePeriods, profitPeriod]);

  const periodStats = useMemo(() => {
    const profit = totalValue - totalInvested;
    const yieldVal = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
    if (profitPeriod === 'total')
      return {
        profit,
        yield: yieldVal,
        labelSuffix: earliestPurchaseDate
          ? `em ${calculateDetailedAge(earliestPurchaseDate)}`
          : '(Acumulado)',
      };
    if (!earliestPurchaseDate) return { profit: 0, yield: 0, labelSuffix: '(Sem data)' };
    const diffDays = walletAgeInDays;
    let divider =
      profitPeriod === 'day' ? diffDays : profitPeriod === 'month' ? diffDays / 30 : diffDays / 365;
    if (divider === 0) divider = 1;
    return {
      profit: profit / divider,
      yield: yieldVal / divider,
      labelSuffix:
        profitPeriod === 'day'
          ? '(Média/Dia)'
          : profitPeriod === 'month'
            ? '(Média/Mês)'
            : '(Média/Ano)',
    };
  }, [profitPeriod, totalValue, totalInvested, earliestPurchaseDate, walletAgeInDays]);

  const showEmptyState = (positions.length === 0 && !loading) || debugShowEmpty;

  return {
    activeTab,
    apiDebug,
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
    transactionsMap,
    setActiveTab,
    setAllocationView,
    setTimeRange,
    setSelectedAssetTicker,
    setProfitPeriod,
    setHighlightedDate,
    setDebugShowEmpty,
  };
};
