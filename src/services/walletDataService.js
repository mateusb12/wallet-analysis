// src/services/walletDataService.js

// 1. Parsing the hardcoded CSV data provided
const RAW_WALLET_DATA = [
  {
    ticker: "BBAS3",
    name: "BCO BRASIL S.A.",
    qty: 5,
    price_close: 22.22,
    total_value: 111.10,
    type: "Ação"
  },
  {
    ticker: "BBSE3",
    name: "BB SEGURIDADE PARTICIPAÇÕES S.A.",
    qty: 9,
    price_close: 34.60,
    total_value: 311.40,
    type: "Ação"
  },
  {
    ticker: "WEGE3",
    name: "WEG S.A.",
    qty: 5,
    price_close: 44.40,
    total_value: 222.00,
    type: "Ação"
  }
];

export const fetchWalletPositions = async () => {
  // Simulating API delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(RAW_WALLET_DATA);
    }, 500);
  });
};

/**
 * Since the CSV doesn't have history, we mock a performance curve
 * based on the current total value to show the chart concept.
 */
export const fetchWalletPerformanceHistory = async (timeRangeMonths = 12) => {
  const currentTotal = RAW_WALLET_DATA.reduce((acc, item) => acc + item.total_value, 0);

  return new Promise((resolve) => {
    setTimeout(() => {
      const history = [];
      const today = new Date();

      // Generate points going backwards
      for (let i = timeRangeMonths * 30; i >= 0; i -= 5) { // Every 5 days
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Random volatility to simulate market movement
        // We ensure it ends exactly at the currentTotal
        const volatility = Math.random() * 0.04 - 0.015; // slightly upward trend
        const historicalFactor = 1 - (i / (timeRangeMonths * 30)) * 0.15; // Assume 15% growth over period

        // Add some noise
        const randomNoise = (Math.random() - 0.5) * 10;

        const value = (currentTotal * historicalFactor) + randomNoise;
        const invested = currentTotal * 0.85; // Simulate that we invested 85% of current value

        history.push({
          trade_date: date.toISOString().split('T')[0],
          portfolio_value: parseFloat(value.toFixed(2)),
          invested_amount: parseFloat(invested.toFixed(2)), // Flat line for simplicity
          cdi_benchmark: parseFloat((invested * (1 + (0.01 * (timeRangeMonths * 30 - i) / 30))).toFixed(2)) // Mock CDI
        });
      }
      resolve(history);
    }, 800);
  });
};