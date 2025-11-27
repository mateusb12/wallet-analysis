import { fetchFiiChartData } from './b3service.js';
import { getIfixRange } from './ifixService.js';

const SIMULATED_TODAY = new Date('2025-11-27');

const RAW_WALLET_DATA = [
  {
    ticker: 'BBAS3',
    name: 'BCO BRASIL S.A.',
    qty: 5,
    price_close: 22.22,
    total_value: 111.1,
    type: 'stock',
    purchaseDate: '2025-11-19',
  },
  {
    ticker: 'BBSE3',
    name: 'BB SEGURIDADE PARTICIPAÇÕES S.A.',
    qty: 9,
    price_close: 34.6,
    total_value: 311.4,
    type: 'stock',
    purchaseDate: '2025-11-18',
  },
  {
    ticker: 'WEGE3',
    name: 'WEG S.A.',
    qty: 5,
    price_close: 44.4,
    total_value: 222.0,
    type: 'stock',
    purchaseDate: '2025-11-18',
  },
  {
    ticker: 'IVVB11',
    name: 'ISHARES S&P 500 FUNDO DE ÍNDICE',
    qty: 1,
    price_close: 408.65,
    total_value: 408.65,
    type: 'etf',
    purchaseDate: '2025-11-18',
  },
  {
    ticker: 'QQQQ11',
    name: 'BUENA VISTA V FUNDO DE ÍNDICE',
    qty: 3,
    price_close: 97.3,
    total_value: 291.9,
    type: 'etf',
    purchaseDate: '2025-11-18',
  },
  {
    ticker: 'BTLG11',
    name: 'BTG PACTUAL LOGISTICA FDO INV IMOB RESP LIM',
    qty: 1,
    price_close: 103.58,
    total_value: 103.58,
    type: 'fii',
    purchaseDate: '2025-11-18',
  },
  {
    ticker: 'KNCR11',
    name: 'KINEA RENDIMENTOS IMOBILIÁRIOS FII RESP LIM',
    qty: 1,
    price_close: 105.55,
    total_value: 105.55,
    type: 'fii',
    purchaseDate: '2025-11-18',
  },
  {
    ticker: 'KNHF11',
    name: 'KINEA HEDGE FUND FII RESP LIM',
    qty: 4,
    price_close: 91.92,
    total_value: 367.68,
    type: 'fii',
    purchaseDate: '2025-11-18',
  },
  {
    ticker: 'XPCM11',
    name: 'XP CORPORATE MACAÉ FII RESP LIM',
    qty: 10,
    price_close: 7.91,
    total_value: 79.1,
    type: 'fii',
    purchaseDate: '2025-11-18',
  },
];

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

const fetchRealFiiPerformance = async (months) => {
  const fiis = RAW_WALLET_DATA.filter((item) => item.type === 'fii');
  if (fiis.length === 0) return [];

  const earliestPurchaseDate = fiis.reduce(
    (min, p) => (p.purchaseDate < min ? p.purchaseDate : min),
    fiis[0].purchaseDate
  );

  console.log('--- START FII GROUP DEBUG ---');
  console.log('Earliest Purchase Date:', earliestPurchaseDate);
  console.log('Target Range:', earliestPurchaseDate, 'to', SIMULATED_TODAY);

  try {
    const histories = await Promise.all(
      fiis.map(async (fii) => {
        const data = await fetchFiiChartData(fii.ticker, months);

        if (data && data.length > 0) {
          const lastDate = data[data.length - 1].trade_date;
          console.log(`Fetched ${fii.ticker}: ${data.length} points. Last date: ${lastDate}`);
        } else {
          console.warn(`Fetched ${fii.ticker}: NO DATA`);
        }

        return {
          ticker: fii.ticker,
          initialQty: fii.qty,
          data: data ? data.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date)) : [],
        };
      })
    );

    const validHistories = histories.filter((h) => h.data.length > 0);
    if (validHistories.length === 0) {
      console.error('EXIT: No valid histories found for any FII');
      return [];
    }

    const allDates = validHistories.flatMap((h) => h.data.map((d) => d.trade_date));

    const todayStr = SIMULATED_TODAY.toISOString().split('T')[0];
    const uniqueDates = [...new Set(allDates)]
      .filter((date) => date >= earliestPurchaseDate && date <= todayStr)
      .sort();

    console.log('Unique Dates Count (Filtered):', uniqueDates.length);
    if (uniqueDates.length > 0) {
      console.log('First Date:', uniqueDates[0]);
      console.log('Last Date:', uniqueDates[uniqueDates.length - 1]);
    } else {
      console.error(
        'EXIT: All fetched dates are older than purchase date (' + earliestPurchaseDate + ')'
      );
      return [];
    }

    if (uniqueDates.length === 0) return [];

    const startDate = uniqueDates[0];
    const endDate = uniqueDates[uniqueDates.length - 1];

    const ifixData = await getIfixRange(startDate, endDate);
    const ifixMap = {};
    ifixData.forEach((i) => (ifixMap[i.trade_date] = parseFloat(i.close_value)));

    let initialInvestedTotal = 0;

    validHistories.forEach((h) => {
      const startRecord = h.data.find((d) => d.trade_date >= earliestPurchaseDate);
      const startPrice = startRecord
        ? parseFloat(startRecord.price_close)
        : h.data[0]?.price_close || 0;
      initialInvestedTotal += startPrice * h.initialQty;
    });

    const portfolioState = validHistories.map((h) => ({
      ticker: h.ticker,
      qty: h.initialQty,
      currentCash: 0,
    }));

    const dailyData = uniqueDates
      .map((date) => {
        let dailyTotalValue = 0;

        portfolioState.forEach((asset, idx) => {
          const historyData = validHistories[idx].data;
          const dayRecord = historyData.find((d) => d.trade_date === date);

          if (dayRecord) {
            const price = parseFloat(dayRecord.price_close);
            const div = parseFloat(dayRecord.dividend_value || 0);

            if (div > 0 && price > 0) {
              const totalDiv = div * asset.qty;
              const newShares = totalDiv / price;
              asset.qty += newShares;
            }
            dailyTotalValue += asset.qty * price;
          }
        });

        return {
          trade_date: date,
          portfolio_value: parseFloat(dailyTotalValue.toFixed(2)),
          invested_amount: parseFloat(initialInvestedTotal.toFixed(2)),
        };
      })
      .filter((d) => d.portfolio_value > 0);

    if (dailyData.length === 0) return [];

    const anchorDate = dailyData[0].trade_date;
    const anchorInvested = dailyData[0].invested_amount;
    const anchorIfix = ifixMap[anchorDate];

    console.group('🔍 FII BENCHMARK DIAGNOSIS');
    console.log('1. Calculation Anchor:', {
      anchorDate,
      anchorInvested,
      anchorIfix,
    });

    console.log('2. IFIX Map Integrity:', {
      hasAnchorIfix: !!anchorIfix,
      totalIfixPoints: Object.keys(ifixMap).length,
      sampleIfixValue: Object.values(ifixMap)[0],
    });

    if (anchorIfix) {
      const firstRealData = dailyData.find((d) => d.trade_date !== anchorDate);
      if (firstRealData) {
        const nextIfix = ifixMap[firstRealData.trade_date];
        const ratio = nextIfix / anchorIfix;
        console.log('3. Test Projection (Day 2):', {
          day2Date: firstRealData.trade_date,
          day2Ifix: nextIfix,
          ratio: ratio,
          projectedValue: anchorInvested * ratio,
        });
      }
    } else {
      console.error('🚨 CRITICAL: Anchor IFIX is missing or Zero! This causes infinity.');
    }
    console.groupEnd();

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

    return finalResult;
  } catch (err) {
    console.error('Error calculating real FII performance:', err);
    return [];
  }
};

export const fetchWalletPerformanceHistory = async (overrideMonths = null) => {
  const timeRangeMonths = overrideMonths || getMaxHistoryMonths();

  const stockTotal = RAW_WALLET_DATA.filter((i) => i.type === 'stock').reduce(
    (acc, item) => acc + item.total_value,
    0
  );
  const etfTotal = RAW_WALLET_DATA.filter((i) => i.type === 'etf').reduce(
    (acc, item) => acc + item.total_value,
    0
  );
  const fiiTotal = RAW_WALLET_DATA.filter((i) => i.type === 'fii').reduce(
    (acc, item) => acc + item.total_value,
    0
  );

  let fiiCurve = await fetchRealFiiPerformance(timeRangeMonths);

  const getFiiStartDate = () => {
    const fiis = RAW_WALLET_DATA.filter((i) => i.type === 'fii');
    if (!fiis.length) return null;
    return fiis.reduce(
      (min, p) => (p.purchaseDate < min ? p.purchaseDate : min),
      fiis[0].purchaseDate
    );
  };
  const fiiStartDate = getFiiStartDate();

  if (!fiiCurve || fiiCurve.length === 0) {
    console.warn('Using simulation for FIIs due to missing historical data.');
    fiiCurve = generateFakeCurve(fiiTotal, timeRangeMonths, 0.05, 1.08, 0.11);

    if (fiiStartDate) {
      fiiCurve = fiiCurve.filter((d) => d.trade_date >= fiiStartDate);
    }
  }

  const stockCurve = generateFakeCurve(stockTotal, timeRangeMonths, 0.15, 1.2, 0.12);
  const etfCurve = generateFakeCurve(etfTotal, timeRangeMonths, 0.1, 1.1, 0.1);

  const validCurves = [stockCurve, etfCurve, fiiCurve].filter((c) => c && c.length > 0);
  const totalCurve = combineHistories(validCurves);

  return {
    stock: stockCurve,
    etf: etfCurve,
    fii: fiiCurve,
    total: totalCurve,
  };
};

export const fetchSpecificAssetHistory = async (ticker, months = 12) => {
  const asset = RAW_WALLET_DATA.find((a) => a.ticker === ticker);
  if (!asset) return [];

  const todayStr = SIMULATED_TODAY.toISOString().split('T')[0];

  if (asset.type === 'fii') {
    try {
      const data = await fetchFiiChartData(asset.ticker, months);
      if (!data || data.length === 0) return [];

      const sortedData = data
        .filter((d) => d.trade_date >= asset.purchaseDate && d.trade_date <= todayStr)
        .sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));

      if (sortedData.length === 0) return [];

      const startDate = sortedData[0].trade_date;
      const endDate = sortedData[sortedData.length - 1].trade_date;

      const ifixData = await getIfixRange(startDate, endDate);
      const ifixMap = {};
      ifixData.forEach((i) => (ifixMap[i.trade_date] = parseFloat(i.close_value)));

      const anchorDate = sortedData[0].trade_date;

      let anchorIfix = ifixMap[anchorDate];
      if (!anchorIfix) {
        const firstValidIfix = ifixData.find((i) => i.trade_date >= anchorDate);
        anchorIfix = firstValidIfix ? parseFloat(firstValidIfix.close_value) : null;
      }

      const initialFixedInvestment = asset.total_value;

      let currentQty = asset.qty;
      let lastKnownIfix = anchorIfix;

      return sortedData.map((day) => {
        const price = parseFloat(day.price_close);
        const div = parseFloat(day.dividend_value || 0);

        if (div > 0 && price > 0) {
          const totalDiv = div * currentQty;
          currentQty += totalDiv / price;
        }
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
      console.error('Error fetching specific FII history', error);
      const fake = generateFakeCurve(asset.total_value, months, 0.05, 1.05, 0.11);
      return fake.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
    }
  } else {
    const fake = generateFakeCurve(asset.total_value, months, 0.15, 1.2, 0.1);
    return fake.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
  }
};
