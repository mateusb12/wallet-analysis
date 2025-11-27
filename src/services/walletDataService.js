import { fetchFiiChartData } from './b3service.js';
import { getIfixRange } from './ifixService.js';

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
  const today = new Date();

  if (currentTotal === 0) return [];

  for (let i = timeRangeMonths * 30; i >= 0; i -= 5) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const progress = 1 - i / (timeRangeMonths * 30);
    const randomNoise = (Math.random() - 0.5) * (currentTotal * volatilityBase);
    const value = currentTotal * 0.8 + currentTotal * 0.2 * progress * trendFactor + randomNoise;

    const invested = currentTotal * 0.85 + Math.random() * currentTotal * 0.05;
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

  try {
    const histories = await Promise.all(
      fiis.map(async (fii) => {
        const data = await fetchFiiChartData(fii.ticker, months);

        return {
          ticker: fii.ticker,
          initialQty: fii.qty,
          data: data.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date)),
        };
      })
    );

    const allDates = histories.flatMap((h) => h.data.map((d) => d.trade_date));
    allDates.sort();
    const startDate = allDates[0];
    const endDate = allDates[allDates.length - 1];

    if (!startDate) return [];

    const ifixData = await getIfixRange(startDate, endDate);
    const ifixMap = {};
    ifixData.forEach((i) => (ifixMap[i.trade_date] = parseFloat(i.close_value)));
    const baseIfix = ifixData.length > 0 ? parseFloat(ifixData[0].close_value) : 1;

    const dateMap = {};

    const portfolioState = histories.map((h) => ({
      ticker: h.ticker,
      qty: h.initialQty,

      currentCash: 0,
    }));

    const uniqueDates = [...new Set(allDates)].sort();

    let initialInvestedTotal = 0;
    histories.forEach((h, idx) => {
      const firstPrice = h.data[0]?.price_close || 0;
      initialInvestedTotal += firstPrice * h.initialQty;
    });

    uniqueDates.forEach((date) => {
      let dailyTotalValue = 0;

      portfolioState.forEach((asset, idx) => {
        const historyData = histories[idx].data;

        const dayRecord = historyData.find((d) => d.trade_date === date);

        if (dayRecord) {
          const price = parseFloat(dayRecord.price_close);
          const div = parseFloat(dayRecord.dividend_value || 0);

          if (div > 0) {
            const totalDiv = div * asset.qty;
            if (price > 0) {
              const newShares = totalDiv / price;
              asset.qty += newShares;
            }
          }

          dailyTotalValue += asset.qty * price;
        } else {
          console.warn(`No data for ${asset.ticker} on ${date}`);
        }
      });

      const currentIfix = ifixMap[date] || 0;
      const ifixPerformance = currentIfix / baseIfix;
      const benchmarkValue = initialInvestedTotal * ifixPerformance;

      if (dailyTotalValue > 0) {
        dateMap[date] = {
          trade_date: date,
          portfolio_value: parseFloat(dailyTotalValue.toFixed(2)),
          invested_amount: parseFloat(initialInvestedTotal.toFixed(2)),
          benchmark_value: parseFloat(benchmarkValue.toFixed(2)),
        };
      }
    });

    return Object.values(dateMap);
  } catch (err) {
    console.error('Error calculating real FII performance:', err);
    return [];
  }
};

export const fetchWalletPerformanceHistory = async (timeRangeMonths = 12) => {
  const stockTotal = RAW_WALLET_DATA.filter((i) => i.type === 'stock').reduce(
    (acc, item) => acc + item.total_value,
    0
  );
  const etfTotal = RAW_WALLET_DATA.filter((i) => i.type === 'etf').reduce(
    (acc, item) => acc + item.total_value,
    0
  );

  const [stockCurve, etfCurve, fiiCurve] = await Promise.all([
    new Promise((resolve) =>
      resolve(generateFakeCurve(stockTotal, timeRangeMonths, 0.15, 1.2, 0.12))
    ),

    new Promise((resolve) => resolve(generateFakeCurve(etfTotal, timeRangeMonths, 0.1, 1.1, 0.1))),

    fetchRealFiiPerformance(timeRangeMonths),
  ]);

  const validCurves = [stockCurve, etfCurve, fiiCurve].filter((c) => c && c.length > 0);
  const totalCurve = combineHistories(validCurves);

  return {
    stock: stockCurve,
    etf: etfCurve,
    fii: fiiCurve,
    total: totalCurve,
  };
};
