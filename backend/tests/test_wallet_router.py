import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd

from backend.source.features.wallet.wallet_router import (
    _build_cdi_factors,
    _calculate_purchase_dividends,
    get_dashboard_data,
)


class CdiFactorsTest(unittest.TestCase):
    def test_does_not_apply_friday_rate_on_weekend(self):
        common_idx = pd.date_range('2026-01-02', '2026-01-05', freq='D')
        benchmark_query = [
            ('2026-01-02', 1.0),
            ('2026-01-05', 1.0),
        ]

        factors = _build_cdi_factors(benchmark_query, common_idx)

        self.assertEqual(list(factors), [1.01, 1.0, 1.0, 1.01])


class DashboardCurrentPriceTest(unittest.TestCase):
    def test_does_not_use_purchase_price_when_sql_has_no_current_price(self):
        purchase = SimpleNamespace(
            ticker='BBAS3',
            name='Banco do Brasil',
            type='stock',
            qty=10,
            price=20,
            trade_date=date(2026, 1, 2),
            settlement_date=None,
        )

        wallets = SimpleNamespace(
            list_purchases=lambda user_id: [purchase],
            list_proventos=lambda user_id: [],
            get_adjusted_prices_for_purchases=lambda keys: [],
            get_latest_prices=lambda tickers: [],
            get_classifications=lambda tickers: [],
            get_prices_from_previous_year=lambda tickers, start_year: [],
        )

        with patch('backend.source.features.wallet.wallet_router._calculate_history_logic', return_value=[]):
            response = get_dashboard_data(wallets=wallets, current_user='user-1')

        position = response['positions'][0]
        self.assertIsNone(position['current_price'])
        self.assertIsNone(position['total_value'])


class PurchaseDividendAllocationTest(unittest.TestCase):
    def test_uses_provento_quantity_as_the_dividend_basis(self):
        purchases = [
            SimpleNamespace(ticker='BBAS3', qty=2, trade_date=date(2026, 1, 1), settlement_date=None),
            SimpleNamespace(ticker='BBAS3', qty=8, trade_date=date(2026, 2, 1), settlement_date=None),
        ]
        proventos = [
            SimpleNamespace(
                product='BBAS3',
                date=date(2026, 3, 1),
                quantity=10,
                total_value=50,
            )
        ]

        self.assertEqual(_calculate_purchase_dividends(purchases, proventos), [10.0, 40.0])


if __name__ == '__main__':
    unittest.main()
