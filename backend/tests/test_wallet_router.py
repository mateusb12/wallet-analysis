import unittest

import pandas as pd

from backend.source.features.wallet.wallet_router import _build_cdi_factors


class CdiFactorsTest(unittest.TestCase):
    def test_does_not_apply_friday_rate_on_weekend(self):
        common_idx = pd.date_range('2026-01-02', '2026-01-05', freq='D')
        benchmark_query = [
            ('2026-01-02', 1.0),
            ('2026-01-05', 1.0),
        ]

        factors = _build_cdi_factors(benchmark_query, common_idx)

        self.assertEqual(list(factors), [1.01, 1.0, 1.0, 1.01])


if __name__ == '__main__':
    unittest.main()
