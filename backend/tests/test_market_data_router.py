import unittest

import pandas as pd

from backend.source.features.market_data.market_data_router import normalize_yahoo_dividends


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


if __name__ == '__main__':
    unittest.main()
