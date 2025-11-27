const RAW_WALLET_DATA = [
  {
    ticker: 'BBAS3',
    name: 'BCO BRASIL S.A.',
    qty: 5,
    price_close: 22.22,
    total_value: 111.1,
    type: 'stock',
  },
  {
    ticker: 'BBSE3',
    name: 'BB SEGURIDADE PARTICIPAÇÕES S.A.',
    qty: 9,
    price_close: 34.6,
    total_value: 311.4,
    type: 'stock',
  },
  {
    ticker: 'WEGE3',
    name: 'WEG S.A.',
    qty: 5,
    price_close: 44.4,
    total_value: 222.0,
    type: 'stock',
  },

  {
    ticker: 'IVVB11',
    name: 'ISHARES S&P 500 FUNDO DE ÍNDICE',
    qty: 1,
    price_close: 408.65,
    total_value: 408.65,
    type: 'etf',
  },
  {
    ticker: 'QQQQ11',
    name: 'BUENA VISTA V FUNDO DE ÍNDICE',
    qty: 3,
    price_close: 97.3,
    total_value: 291.9,
    type: 'etf',
  },

  {
    ticker: 'BTLG11',
    name: 'BTG PACTUAL LOGISTICA FDO INV IMOB RESP LIM',
    qty: 1,
    price_close: 103.58,
    total_value: 103.58,
    type: 'fii',
  },
  {
    ticker: 'KNCR11',
    name: 'KINEA RENDIMENTOS IMOBILIÁRIOS FII RESP LIM',
    qty: 1,
    price_close: 105.55,
    total_value: 105.55,
    type: 'fii',
  },
  {
    ticker: 'KNHF11',
    name: 'KINEA HEDGE FUND FII RESP LIM',
    qty: 4,
    price_close: 91.92,
    total_value: 367.68,
    type: 'fii',
  },
  {
    ticker: 'XPCM11',
    name: 'XP CORPORATE MACAÉ FII RESP LIM',
    qty: 10,
    price_close: 7.91,
    total_value: 79.1,
    type: 'fii',
  },
];

const combineHistories = (curves) => {
  if (!curves || curves.length === 0) return [];

  const baseCurve = curves[0];

  return baseCurve.map((point, index) => {
    const combined = curves.reduce(
      (acc, curve) => {
        const item = curve[index] || {};
        return {
          portfolio_value: acc.portfolio_value + (item.portfolio_value || 0),
          invested_amount: acc.invested_amount + (item.invested_amount || 0),
        };
      },
      { portfolio_value: 0, invested_amount: 0 }
    );

    return {
      trade_date: point.trade_date,
      portfolio_value: parseFloat(combined.portfolio_value.toFixed(2)),
      invested_amount: parseFloat(combined.invested_amount.toFixed(2)),

      benchmark_value: point.benchmark_value,
    };
  });
};

export const fetchWalletPositions = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(RAW_WALLET_DATA);
    }, 500);
  });
};

const generateCurve = (
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

    const progress = 1 - i / (timeRangeMonths * 30);
    const randomNoise = (Math.random() - 0.5) * (currentTotal * volatilityBase);
    const value = currentTotal * 0.8 + currentTotal * 0.2 * progress * trendFactor + randomNoise;

    const invested = currentTotal * 0.85 + Math.random() * currentTotal * 0.05;
    const benchmark = invested * Math.pow(1 + benchmarkRate, (timeRangeMonths * 30 - i) / 365);

    history.push({
      trade_date: date.toISOString().split('T')[0],
      portfolio_value: parseFloat(Math.max(0, value).toFixed(2)),
      invested_amount: parseFloat(invested.toFixed(2)),
      benchmark_value: parseFloat(benchmark.toFixed(2)),
    });
  }
  return history;
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
  const fiiTotal = RAW_WALLET_DATA.filter((i) => i.type === 'fii').reduce(
    (acc, item) => acc + item.total_value,
    0
  );

  return new Promise((resolve) => {
    setTimeout(() => {
      const stockCurve = generateCurve(stockTotal, timeRangeMonths, 0.15, 1.2, 0.12);
      const etfCurve = generateCurve(etfTotal, timeRangeMonths, 0.1, 1.1, 0.1);
      const fiiCurve = generateCurve(fiiTotal, timeRangeMonths, 0.05, 1.05, 0.11);

      const validCurves = [stockCurve, etfCurve, fiiCurve].filter((c) => c.length > 0);
      const totalCurve = combineHistories(validCurves);

      resolve({
        stock: stockCurve,
        etf: etfCurve,
        fii: fiiCurve,
        total: totalCurve,
      });
    }, 800);
  });
};
