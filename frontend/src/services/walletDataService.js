import { fetchFiiChartData } from './b3service.js';
import { getIfixRange } from './ifixService.js';
import { getLastIpcaDate } from './ipcaService.js';
import { cdiService } from './cdiService.js';

const SIMULATED_TODAY = new Date();

const SOURCE_POSITIONS = [
  {
    ticker: 'BBAS3',
    name: 'BANCO DO BRASIL S/A',
    qty: 5,
    purchase_price: 21.79,
    type: 'stock',
    purchaseDate: '2025-11-24',
  },
  {
    ticker: 'BBSE3',
    name: 'BB SEGURIDADE PARTICIPACOES S.A.',
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
    name: 'ISHARE S&P 500 FIC EM FUNDO DE INDICE IE',
    qty: 1,
    purchase_price: 398.6,
    type: 'etf',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'QQQQ11',
    name: 'BUENA VISTA NASDAQ-100 HIGH BETA INDEX FUNDO DE INDICE',
    qty: 3,
    purchase_price: 95.9,
    type: 'etf',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'BTLG11',
    name: 'BTG PACTUAL LOGISTICA FUNDO DE INVESTIMENTO IMOBILIARIO',
    qty: 1,
    purchase_price: 104.14,
    type: 'fii',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'KNCR11',
    name: 'KINEA RENDIMENTOS IMOBILIÁRIOS FDO INV IMOB - FII',
    qty: 1,
    purchase_price: 104.99,
    type: 'fii',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'KNHF11',
    name: 'KINEA HEDGE FUND FII',
    qty: 4,
    purchase_price: 92.21,
    type: 'fii',
    purchaseDate: '2025-11-21',
  },
  {
    ticker: 'XPCM11',
    name: 'XP CORPORATE MACAÉ FDO INV IMO',
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

const getDaysDiff = (dateStr1, dateStr2) => {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const fetchWalletPositions = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(RAW_WALLET_DATA);
    }, 500);
  });
};

const getMaxHistoryMonths = () => {
  const dates = RAW_WALLET_DATA.map((d) => new Date(d.purchaseDate).getTime());

  if (dates.length === 0) return 6;

  const minDate = new Date(Math.min(...dates));
  const today = new Date(SIMULATED_TODAY);
  const months =
    (today.getFullYear() - minDate.getFullYear()) * 12 + (today.getMonth() - minDate.getMonth());

  return Math.max(6, months + 1);
};

const combineHistories = (curves) => {
  if (!curves || curves.length === 0) return [];

  const dateMap = {};

  curves.forEach((curve) => {
    curve.forEach((point) => {
      if (!dateMap[point.trade_date]) {
        dateMap[point.trade_date] = {
          portfolio_value: 0,
          invested_amount: 0,
          benchmark_value: 0,
        };
      }
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

const calculateCdiCurve = (totalCurve, cdiHistory) => {
  if (!totalCurve || totalCurve.length === 0) return [];

  const cdiMap = {};
  if (cdiHistory) {
    cdiHistory.forEach((item) => {
      cdiMap[item.trade_date] = item.value;
    });
  }

  let accumulatedBenchmark = totalCurve[0].invested_amount;
  let previousInvested = totalCurve[0].invested_amount;

  return totalCurve.map((day, index) => {
    if (index > 0) {
      const dailyRate = cdiMap[day.trade_date] || 0;

      const factor = 1 + dailyRate / 100;
      accumulatedBenchmark = accumulatedBenchmark * factor;

      const netDeposit = day.invested_amount - previousInvested;
      if (netDeposit !== 0) {
        accumulatedBenchmark += netDeposit;
      }
    }

    previousInvested = day.invested_amount;

    return {
      ...day,
      benchmark_value: parseFloat(accumulatedBenchmark.toFixed(2)),
    };
  });
};

const generateFakeCurve = (
  currentTotal,
  timeRangeMonths,
  volatilityBase,
  trendFactor,
  benchmarkRate
) => {
  const history = [];
  const today = new Date(SIMULATED_TODAY);

  if (currentTotal === 0) return [];

  for (let i = timeRangeMonths * 30; i >= 0; i -= 2) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const progress = 1 - i / (timeRangeMonths * 30);
    const randomNoise = (Math.random() - 0.5) * (currentTotal * volatilityBase);

    const value = currentTotal * 0.8 + currentTotal * 0.2 * progress * trendFactor + randomNoise;
    const invested = currentTotal;
    const benchmark = invested * Math.pow(1 + benchmarkRate, (timeRangeMonths * 30 - i) / 365);

    history.push({
      trade_date: dateStr,
      portfolio_value: parseFloat(Math.max(0, value).toFixed(2)),
      invested_amount: parseFloat(invested.toFixed(2)),
      benchmark_value: parseFloat(benchmark.toFixed(2)),
    });
  }
  return history;
};

const getPriceFromRecord = (record) => {
  if (!record) return 0;

  const val = record.close || record.price_close || record.purchase_price;
  return val ? parseFloat(val) : 0;
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
          data: data ? data.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date)) : [],
        };
      })
    );

    const validHistories = histories.filter((h) => h.data.length > 0);
    if (validHistories.length === 0) return { chartData: [], warnings: [] };

    const allDates = validHistories.flatMap((h) => h.data.map((d) => d.trade_date));
    const uniqueDates = [...new Set(allDates)].sort();

    if (uniqueDates.length === 0) return { chartData: [], warnings: [] };

    const startDate = uniqueDates[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const ifixData = await getIfixRange(startDate, todayStr);
    const ifixMap = {};
    ifixData.forEach((i) => (ifixMap[i.trade_date] = parseFloat(i.close_value)));

    const assetLastDates = validHistories.map((h) => ({
      ticker: h.ticker,
      lastDate: h.data[h.data.length - 1].trade_date,
    }));
    const ifixLastDate = ifixData.length > 0 ? ifixData[ifixData.length - 1].trade_date : startDate;
    const allLastDates = [...assetLastDates.map((a) => a.lastDate), ifixLastDate];
    const globalMaxDate = allLastDates.reduce(
      (max, item) => (item > max ? item : max),
      allLastDates[0]
    );

    const warnings = assetLastDates
      .filter((item) => getDaysDiff(item.lastDate, globalMaxDate) > 3)
      .map((item) => item.ticker);

    if (getDaysDiff(ifixLastDate, globalMaxDate) > 3) {
      warnings.push('Benchmark (IFIX)');
    }

    let initialInvestedTotal = 0;

    const portfolioState = validHistories.map((h) => {
      const startRecord = h.data.find((d) => d.trade_date >= earliestPurchaseDate);
      const startPrice = startRecord
        ? getPriceFromRecord(startRecord)
        : getPriceFromRecord(h.data[0]);

      initialInvestedTotal += startPrice * h.initialQty;

      return {
        ticker: h.ticker,
        qty: h.initialQty,
        lastPrice: startPrice,
      };
    });

    const calculationDates = uniqueDates.filter((d) => d <= todayStr);

    const dailyData = calculationDates
      .map((date) => {
        let dailyTotalValue = 0;

        portfolioState.forEach((asset, idx) => {
          const historyData = validHistories[idx].data;
          const dayRecord = historyData.find((d) => d.trade_date === date);

          if (dayRecord) {
            const price = getPriceFromRecord(dayRecord);
            const div = parseFloat(dayRecord.dividend_value || 0);

            if (price > 0) asset.lastPrice = price;

            if (div > 0 && asset.lastPrice > 0) {
              const totalDiv = div * asset.qty;
              asset.qty += totalDiv / asset.lastPrice;
            }
          }
          dailyTotalValue += asset.qty * asset.lastPrice;
        });

        return {
          trade_date: date,
          portfolio_value: parseFloat(dailyTotalValue.toFixed(2)),
          invested_amount: parseFloat(initialInvestedTotal.toFixed(2)),
        };
      })
      .filter((d) => d.portfolio_value > 0);

    if (dailyData.length === 0) return { chartData: [], warnings };

    const anchorDate = dailyData[0].trade_date;
    const anchorInvested = dailyData[0].invested_amount;
    const anchorIfix = ifixMap[anchorDate];
    let lastKnownIfix = anchorIfix;

    const finalResult = dailyData.map((day) => {
      let currentIfix = ifixMap[day.trade_date];
      if (!currentIfix && lastKnownIfix) currentIfix = lastKnownIfix;
      if (currentIfix) lastKnownIfix = currentIfix;

      let benchmarkVal = day.invested_amount;
      if (anchorIfix && currentIfix) {
        const performanceRatio = currentIfix / anchorIfix;
        benchmarkVal = anchorInvested * performanceRatio;
      }

      return {
        ...day,
        benchmark_value: parseFloat(benchmarkVal.toFixed(2)),
      };
    });

    return { chartData: finalResult, warnings };
  } catch (err) {
    console.error(`Error calculating real performance for ${assetType}:`, err);
    return { chartData: [], warnings: [] };
  }
};

export const fetchRealFiiPerformance = (months) => fetchRealAssetPerformance(months, 'fii');
export const fetchRealStocksPerformance = (months) => fetchRealAssetPerformance(months, 'stock');
export const fetchRealETFPerformance = (months) => fetchRealAssetPerformance(months, 'etf');

export const fetchWalletPerformanceHistory = async (overrideMonths = null) => {
  const timeRangeMonths = overrideMonths || getMaxHistoryMonths();

  const [fiiResult, stockResult, etfResult, lastIpcaDate] = await Promise.all([
    fetchRealFiiPerformance(timeRangeMonths),
    fetchRealStocksPerformance(timeRangeMonths),
    fetchRealETFPerformance(timeRangeMonths),
    getLastIpcaDate(),
  ]);

  const fiiCurve = fiiResult.chartData;
  const stockCurve = stockResult.chartData;
  const etfCurve = etfResult.chartData;

  const allWarnings = [...fiiResult.warnings, ...stockResult.warnings, ...etfResult.warnings];

  if (lastIpcaDate) {
    const today = new Date().toISOString().split('T')[0];
    const daysDiff = getDaysDiff(lastIpcaDate, today);

    if (daysDiff > 50) {
      allWarnings.push('Índice IPCA');
    }
  } else {
    allWarnings.push('Índice IPCA (Sem dados)');
  }

  const uniqueWarnings = [...new Set(allWarnings)];

  const validCurves = [stockCurve, etfCurve, fiiCurve].filter((c) => c && c.length > 0);
  let totalCurve = combineHistories(validCurves);

  if (totalCurve.length > 0) {
    const startDate = totalCurve[0].trade_date;
    const endDate = totalCurve[totalCurve.length - 1].trade_date;

    try {
      const cdiData = await cdiService.getCdiRange(startDate, endDate);

      totalCurve = calculateCdiCurve(totalCurve, cdiData);
    } catch (err) {
      console.error('Failed to apply CDI benchmark:', err);
    }
  }

  return {
    stock: stockCurve,
    etf: etfCurve,
    fii: fiiCurve,
    total: totalCurve,
    warnings: uniqueWarnings,
  };
};

export const fetchSpecificAssetHistory = async (ticker, months = 60) => {
  const asset = RAW_WALLET_DATA.find((a) => a.ticker === ticker);
  if (!asset) return [];

  const todayStr = SIMULATED_TODAY.toISOString().split('T')[0];

  const processHistory = async () => {
    try {
      const data = await fetchFiiChartData(asset.ticker, 60);

      if (!data || data.length === 0) return [];

      const sortedData = data
        .filter((d) => d.trade_date <= todayStr)
        .sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));

      if (sortedData.length === 0) return [];

      const startDate = sortedData[0].trade_date;
      const endDate = sortedData[sortedData.length - 1].trade_date;

      const ifixData = await getIfixRange(startDate, endDate);
      const ifixMap = {};
      ifixData.forEach((i) => (ifixMap[i.trade_date] = parseFloat(i.close_value)));

      const anchorDate = asset.purchaseDate > startDate ? asset.purchaseDate : startDate;

      let anchorIfix = ifixMap[anchorDate];
      if (!anchorIfix) {
        const exactMatch = ifixData.find((i) => i.trade_date === anchorDate);
        anchorIfix = exactMatch ? parseFloat(exactMatch.close_value) : null;

        if (!anchorIfix) {
          const closest = ifixData.find((i) => i.trade_date >= anchorDate);
          anchorIfix = closest ? parseFloat(closest.close_value) : null;
        }
      }

      const initialFixedInvestment = asset.total_value;

      let currentQty = asset.qty;
      let lastKnownIfix = anchorIfix;

      return sortedData.map((day) => {
        const price = getPriceFromRecord(day);
        const div = parseFloat(day.dividend_value || 0);

        const portfolioValue = currentQty * price;

        let currentIfix = ifixMap[day.trade_date];
        if (!currentIfix && lastKnownIfix) currentIfix = lastKnownIfix;
        if (currentIfix) lastKnownIfix = currentIfix;

        let benchmarkVal = initialFixedInvestment;

        if (anchorIfix && currentIfix) {
          const variationRatio = currentIfix / anchorIfix;
          benchmarkVal = initialFixedInvestment * variationRatio;
        }

        return {
          trade_date: day.trade_date,
          portfolio_value: parseFloat(portfolioValue.toFixed(2)),
          invested_amount: parseFloat(initialFixedInvestment.toFixed(2)),
          benchmark_value: parseFloat(benchmarkVal.toFixed(2)),
        };
      });
    } catch (error) {
      console.error('Error fetching specific asset history', error);
      return [];
    }
  };

  return processHistory();
};
