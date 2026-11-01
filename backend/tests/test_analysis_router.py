import unittest

from backend.source.features.analysis.analysis_router import calculate_zscore


class FakeAnalysisRepository:
    def get_price_history(self, ticker, limit):
        self.requested = (ticker, limit)
        return [
            {"trade_date": "2025-01-01", "close": 10},
            {"trade_date": "2025-02-01", "close": 12},
            {"trade_date": "2025-03-01", "close": 11},
        ]


class ZScoreRouteTest(unittest.TestCase):
    def test_calculates_from_analysis_repository_without_supabase(self):
        repository = FakeAnalysisRepository()

        result = calculate_zscore("AUPO11", window_months=2, analysis=repository)

        self.assertEqual(result["ticker"], "AUPO11")
        self.assertEqual(result["stats"]["current"], 11)
        self.assertEqual(len(result["chart_data"]), 3)
        self.assertEqual(repository.requested, ("AUPO11", 160))


if __name__ == "__main__":
    unittest.main()
