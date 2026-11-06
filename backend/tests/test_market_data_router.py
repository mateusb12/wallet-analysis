import unittest

import pandas as pd

from backend.source.features.market_data.market_data_router import (
    find_historical_high,
    normalize_yahoo_dividends,
)


class YahooDividendNormalizationTest(unittest.TestCase):
    def test_keeps_positive_per_share_distributions_by_date(self):
        dividends = pd.Series(
            [0.25, 0.0, -0.1, 0.1234],
            index=pd.to_datetime(['2025-01-02', '2025-02-03', '2025-03-04', '2025-04-05']),
        )

        self.assertEqual(
            normalize_yahoo_dividends(dividends),
            {'2025-01-02': 0.25, '2025-04-05': 0.1234},
        )


class YahooHistoricalHighTest(unittest.TestCase):
    def test_ignores_isolated_price_spike(self):
        prices = pd.Series(
            [25.0, 29_197.08, 31.77, 30.5],
            index=pd.to_datetime(['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04']),
        )

        self.assertEqual(find_historical_high(prices), (31.77, '2025-01-03'))

    def test_keeps_genuine_high(self):
        prices = pd.Series(
            [25.0, 29.0, 31.77, 30.5],
            index=pd.to_datetime(['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04']),
        )

        self.assertEqual(find_historical_high(prices), (31.77, '2025-01-03'))


if __name__ == '__main__':
    unittest.main()
