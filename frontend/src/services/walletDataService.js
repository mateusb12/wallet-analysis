import { fetchFiiChartData, fetchB3Prices } from './b3service.js';
import { getIfixRange } from './ifixService.js';
import { getLastIpcaDate } from './ipcaService.js';
import { cdiService } from './cdiService.js';
import { getIbovRange } from './ibovService.js';

const SIMULATED_TODAY = new Date();

const SOURCE_POSITIONS = [
  {
    ticker: 'BBAS3',
    name: 'BANCO DO BRASIL',
    qty: 5,
    purchase_price: 21.79,
    type: 'stock',
    purchaseDate: '2025-11-24',
  },
  {
    ticker: 'BBSE3',
    name: 'BB SEGURIDADE',
    qty: 9,
    purchase_price: 33.85,
    type: 'stock',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'WEGE3',
    name: 'WEG S.A.',
    qty: 5,
    purchase_price: 43.85,
    type: 'stock',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'IVVB11',
    name: 'ISHARE S&P 500',
    qty: 1,
    purchase_price: 398.6,
    type: 'etf',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'QQQQ11',
    name: 'NASDAQ-100',
    qty: 3,
    purchase_price: 95.9,
    type: 'etf',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'BTLG11',
    name: 'BTG PACTUAL LOG',
    qty: 1,
    purchase_price: 104.14,
    type: 'fii',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'KNCR11',
    name: 'KINEA RENDIM.',
    qty: 1,
    purchase_price: 104.99,
    type: 'fii',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'KNHF11',
    name: 'KINEA HEDGE',
    qty: 4,
    purchase_price: 92.21,
    type: 'fii',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'XPCM11',
    name: 'XP MACAÉ',
    qty: 10,
    purchase_price: 8.23,
    type: 'fii',
    purchaseDate: '2025-11-21',
  },
];

const RAW_WALLET_DATA = SOURCE_POSITIONS.map((position) => ({
  ...position,
  total_value: parseFloat((position.qty * position.purchase_price).toFixed(2)),
}));

const normalizeDate = (dateInput) => {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') return dateInput.split('T')[0];
  if (dateInput instanceof Date) return dateInput.toISOString().split('T')[0];
  return null;
};

export const fetchWalletPositions = async () => {
  return new Promise((resolve) => setTimeout(() => resolve(RAW_WALLET_DATA), 500));
};

const getPriceFromRecord = (record) => {
  if (!record) return 0;

  const val =
    record.close ||
    record.price_close ||
    record.close_value ||
    record.value ||
    record.purchase_price;
  return val ? parseFloat(val) : 0;
};

const detectAnomalies = (data, assetName) => {
  const warnings = [];
  if (!data || data.length < 2) return warnings;

  const THRESHOLD = 0.3;

  for (let i = 1; i < data.length; i++) {
    const curr = getPriceFromRecord(data[i]);
    const prev = getPriceFromRecord(data[i - 1]);
    const date = data[i].trade_date || data[i].ref_date;

    if (isNaN(curr) || isNaN(prev) || prev === 0 || curr === 0) continue;

    const variation = Math.abs((curr - prev) / prev);

    if (variation > THRESHOLD) {
      const type = curr < prev ? 'QUEDA' : 'ALTA';
      const msg = `[ALERTA DADOS] ${assetName}: ${type} de ${(variation * 100).toFixed(0)}% em ${date} (${prev.toFixed(2)} -> ${curr.toFixed(2)}).`;
      console.warn(msg);
      warnings.push(msg);
    }
  }
  return warnings;
};

const fetchBenchmarkData = async (type, startDate, endDate) => {
  try {
    let result = [];

    if (type === 'fii') {
      result = await getIfixRange(startDate, endDate);
    } else if (type === 'stock') {
      result = await getIbovRange(startDate, endDate);
    } else {
      let tickerIndex = '^BVSP';
      if (type === 'etf') tickerIndex = 'IVVB11';

      const { data } = await fetchB3Prices(tickerIndex, 1, 365 * 5);
      if (data) {
        result = data
          .filter((d) => d.trade_date >= startDate && d.trade_date <= endDate)
          .map((d) => ({ trade_date: d.trade_date, close_value: d.close }))
          .sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
      }
    }
    return result;
  } catch (error) {
    console.error(`[Benchmark] Erro fatal buscando ${type}`, error);
    return [];
  }
};

const getMaxHistoryMonths = () => {
  const dates = RAW_WALLET_DATA.map((d) => new Date(d.purchaseDate).getTime());
  if (dates.length === 0) return 6;
  const minDate = new Date(Math.min(...dates));
  const today = new Date(SIMULATED_TODAY);
  return Math.max(
    6,
    (today.getFullYear() - minDate.getFullYear()) * 12 + (today.getMonth() - minDate.getMonth()) + 1
  );
};

const calculateBenchmarkCurve = (portfolioCurve, benchmarkHistory, isRate = false) => {
  if (!portfolioCurve || portfolioCurve.length === 0) return [];

  const indexMap = {};
  if (benchmarkHistory && Array.isArray(benchmarkHistory)) {
    benchmarkHistory.forEach((item) => {
      const val = parseFloat(item.close_value || item.close || item.value || 0);
      if (!isNaN(val) && item.trade_date) {
        indexMap[normalizeDate(item.trade_date)] = val;
      }
    });
  }

  const availableDates = Object.keys(indexMap).sort();

  const getClosestIndexValue = (targetDate) => {
    if (indexMap[targetDate] !== undefined) return indexMap[targetDate];
    let closestDate = null;
    for (let i = 0; i < availableDates.length; i++) {
      if (availableDates[i] > targetDate) break;
      closestDate = availableDates[i];
    }
    if (!closestDate && availableDates.length > 0) closestDate = availableDates[0];
    return closestDate ? indexMap[closestDate] : null;
  };

  let accumulatedBenchmarkCapital = 0;
  let lastKnownIndexValue = null;

  const resultCurve = portfolioCurve.map((day, index) => {
    const dateKey = normalizeDate(day.trade_date);
    const currentIndexValue = getClosestIndexValue(dateKey);
    const currentInvested = day.invested_amount;

    const benchmarkRaw = currentIndexValue !== null ? currentIndexValue : 0;

    if (index === 0) {
      accumulatedBenchmarkCapital = day.portfolio_value;
      if (currentIndexValue !== null && currentIndexValue > 0) {
        lastKnownIndexValue = currentIndexValue;
      }

      return {
        ...day,
        benchmark_value: parseFloat(accumulatedBenchmarkCapital.toFixed(2)),
        benchmark_raw: benchmarkRaw,
      };
    }

    const previousInvested = portfolioCurve[index - 1].invested_amount;
    const netDeposit = currentInvested - previousInvested;

    if (lastKnownIndexValue !== null && currentIndexValue !== null && lastKnownIndexValue > 0) {
      let dailyFactor = 1.0;
      if (isRate) {
        dailyFactor = 1 + currentIndexValue / 100;
      } else {
        dailyFactor = currentIndexValue / lastKnownIndexValue;
      }
      accumulatedBenchmarkCapital = accumulatedBenchmarkCapital * dailyFactor;
    }

    if (netDeposit !== 0) {
      accumulatedBenchmarkCapital += netDeposit;
    }

    if (currentIndexValue !== null && currentIndexValue > 0) {
      lastKnownIndexValue = currentIndexValue;
    }

    return {
      ...day,
      benchmark_value: parseFloat(accumulatedBenchmarkCapital.toFixed(2)),
      benchmark_raw: benchmarkRaw,
    };
  });

  return resultCurve;
};

const fetchRealAssetPerformance = async (months, assetType) => {
  const assetsToCheck = RAW_WALLET_DATA.filter((item) => item.type === assetType);
  if (assetsToCheck.length === 0) return { chartData: [], warnings: [] };

  const earliestPurchaseDate = assetsToCheck.reduce(
    (min, p) => (p.purchaseDate < min ? p.purchaseDate : min),
    assetsToCheck[0].purchaseDate
  );

  try {
    const histories = await Promise.all(
      assetsToCheck.map(async (asset) => {
        const data = await fetchFiiChartData(asset.ticker, months);
        return {
          ticker: asset.ticker,
          initialQty: asset.qty,
          purchaseDate: asset.purchaseDate,
          data: data ? data.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date)) : [],
        };
      })
    );

    const validHistories = histories.filter((h) => h.data.length > 0);
    if (validHistories.length === 0) return { chartData: [], warnings: [] };

    let assetWarnings = [];
    validHistories.forEach((hist) => {
      const w = detectAnomalies(hist.data, hist.ticker);
      if (w.length > 0) assetWarnings = [...assetWarnings, ...w];
    });

    const allDates = validHistories.flatMap((h) => h.data.map((d) => d.trade_date));
    const uniqueDates = [...new Set(allDates)].sort();
    if (uniqueDates.length === 0) return { chartData: [], warnings: assetWarnings };

    const portfolioState = validHistories.map((h) => {
      const purchaseRecord = h.data.find((d) => d.trade_date >= h.purchaseDate);
      const referencePrice = purchaseRecord
        ? getPriceFromRecord(purchaseRecord)
        : getPriceFromRecord(h.data[0]);

      return {
        ticker: h.ticker,
        qty: h.initialQty,
        lastPrice: referencePrice,
        purchaseDate: h.purchaseDate,
        initialCost: referencePrice * h.initialQty,
      };
    });

    const dailyData = uniqueDates
      .map((date) => {
        let dailyTotalValue = 0;
        let dailyInvestedAmount = 0;

        portfolioState.forEach((asset, idx) => {
          const historyData = validHistories[idx].data;
          const dayRecord = historyData.find((d) => d.trade_date === date);

          if (dayRecord) {
            const price = getPriceFromRecord(dayRecord);
            const div = parseFloat(dayRecord.dividend_value || 0);
            if (price > 0) asset.lastPrice = price;

            if (date >= asset.purchaseDate) {
              if (div > 0 && asset.lastPrice > 0) {
                asset.qty += (div * asset.qty) / asset.lastPrice;
              }
            }
          }

          if (date >= asset.purchaseDate) {
            dailyTotalValue += asset.qty * asset.lastPrice;
            dailyInvestedAmount += asset.initialCost;
          }
        });

        return {
          trade_date: date,
          portfolio_value: parseFloat(dailyTotalValue.toFixed(2)),
          invested_amount: parseFloat(dailyInvestedAmount.toFixed(2)),
        };
      })
      .filter((d) => d.portfolio_value > 0);

    const filteredDailyData = dailyData.filter((d) => d.trade_date >= earliestPurchaseDate);

    if (filteredDailyData.length === 0) return { chartData: [], warnings: assetWarnings };

    const effectiveStartDate = filteredDailyData[0].trade_date;
    const endDate = filteredDailyData[filteredDailyData.length - 1].trade_date;

    const benchmarkData = await fetchBenchmarkData(assetType, effectiveStartDate, endDate);

    const benchName =
      assetType === 'fii' ? 'IFIX' : assetType === 'etf' ? 'S&P 500 (IVVB11)' : 'IBOV';
    const benchWarnings = detectAnomalies(benchmarkData, benchName);

    const finalResult = calculateBenchmarkCurve(filteredDailyData, benchmarkData, false);

    return { chartData: finalResult, warnings: [...assetWarnings, ...benchWarnings] };
  } catch (err) {
    console.error(`Error calculating real performance for ${assetType}:`, err);
    return { chartData: [], warnings: [] };
  }
};

export const fetchRealFiiPerformance = (months) => fetchRealAssetPerformance(months, 'fii');
export const fetchRealStocksPerformance = (months) => fetchRealAssetPerformance(months, 'stock');
export const fetchRealETFPerformance = (months) => fetchRealAssetPerformance(months, 'etf');

const combineHistories = (curves) => {
  if (!curves || curves.length === 0) return [];
  const dateMap = {};
  curves.forEach((curve) => {
    curve.forEach((point) => {
      if (!dateMap[point.trade_date])
        dateMap[point.trade_date] = { portfolio_value: 0, invested_amount: 0 };
      dateMap[point.trade_date].portfolio_value += point.portfolio_value || 0;
      dateMap[point.trade_date].invested_amount += point.invested_amount || 0;
    });
  });
  return Object.keys(dateMap)
    .sort()
    .map((date) => ({
      trade_date: date,
      portfolio_value: parseFloat(dateMap[date].portfolio_value.toFixed(2)),
      invested_amount: parseFloat(dateMap[date].invested_amount.toFixed(2)),
      benchmark_value: 0,
    }));
};

export const fetchWalletPerformanceHistory = async (overrideMonths = null) => {
  const timeRangeMonths = overrideMonths || getMaxHistoryMonths();
  const [fiiResult, stockResult, etfResult, lastIpcaDate] = await Promise.all([
    fetchRealFiiPerformance(timeRangeMonths),
    fetchRealStocksPerformance(timeRangeMonths),
    fetchRealETFPerformance(timeRangeMonths),
    getLastIpcaDate(),
  ]);

  const validCurves = [stockResult.chartData, etfResult.chartData, fiiResult.chartData].filter(
    (c) => c && c.length > 0
  );
  let totalCurve = combineHistories(validCurves);

  if (totalCurve.length > 0) {
    const startDate = totalCurve[0].trade_date;
    const endDate = totalCurve[totalCurve.length - 1].trade_date;
    const bufferDate = new Date(startDate);
    bufferDate.setDate(bufferDate.getDate() - 15);
    const bufferStart = normalizeDate(bufferDate);

    try {
      const cdiData = await cdiService.getCdiRange(bufferStart, endDate);
      totalCurve = calculateBenchmarkCurve(totalCurve, cdiData, true);
    } catch (err) {
      console.error('Failed to apply CDI benchmark:', err);
    }
  }

  const allWarnings = [...fiiResult.warnings, ...stockResult.warnings, ...etfResult.warnings];
  if (!lastIpcaDate) allWarnings.push('IPCA (Sem dados)');

  return {
    stock: stockResult.chartData,
    etf: etfResult.chartData,
    fii: fiiResult.chartData,
    total: totalCurve,
    warnings: [...new Set(allWarnings)],
  };
};

export const fetchSpecificAssetHistory = async (ticker, months = 60) => {
  const asset = RAW_WALLET_DATA.find((a) => a.ticker === ticker);
  if (!asset) return [];

  const todayStr = SIMULATED_TODAY.toISOString().split('T')[0];
  try {
    const data = await fetchFiiChartData(asset.ticker, 60);
    if (!data || data.length === 0) return [];

    const sortedData = data
      .filter((d) => d.trade_date <= todayStr)
      .sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));

    if (sortedData.length === 0) return [];

    const purchaseDate = asset.purchaseDate;
    const filteredData = sortedData.filter((d) => d.trade_date >= purchaseDate);

    if (filteredData.length === 0) return [];

    const startDate = filteredData[0].trade_date;
    const endDate = filteredData[filteredData.length - 1].trade_date;

    const benchmarkData = await fetchBenchmarkData(asset.type, startDate, endDate);

    const assetCurve = filteredData.map((day) => {
      const price = getPriceFromRecord(day);
      return {
        trade_date: day.trade_date,
        portfolio_value: parseFloat((asset.qty * price).toFixed(2)),
        invested_amount: parseFloat(asset.total_value.toFixed(2)),

        asset_price_raw: price,
      };
    });

    return calculateBenchmarkCurve(assetCurve, benchmarkData, false);
  } catch (error) {
    console.error('Error fetching specific asset history', error);
    return [];
  }
};
