from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.source.core.dependencies import get_b3_repository
from backend.source.persistence.ports import B3Repository


b3_bp = APIRouter(prefix="/data/b3", tags=["B3 Data"])


@b3_bp.get("/prices")
def get_prices(
    ticker: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    repository: B3Repository = Depends(get_b3_repository),
):
    return repository.get_prices(ticker.upper(), (page - 1) * page_size, page_size)


@b3_bp.get("/stocks")
def get_unique_stock_tickers(repository: B3Repository = Depends(get_b3_repository)):
    return repository.get_unique_stock_tickers()


@b3_bp.get("/stocks/{ticker}/history")
def get_full_stock_history(
    ticker: str,
    limit: int = Query(1300, ge=1, le=5000),
    repository: B3Repository = Depends(get_b3_repository),
):
    return repository.get_full_stock_history(ticker.upper(), limit)


@b3_bp.get("/tickers")
def get_unique_tickers(repository: B3Repository = Depends(get_b3_repository)):
    return repository.get_unique_tickers()


@b3_bp.get("/fiis/dividends")
def get_fii_dividends(
    ticker: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    repository: B3Repository = Depends(get_b3_repository),
):
    return repository.get_fii_dividends(
        ticker.upper() if ticker else None,
        (page - 1) * page_size,
        page_size,
    )


@b3_bp.get("/fiis/{ticker}/chart")
def get_fii_chart_data(
    ticker: str,
    start_date: str | None = Query(None),
    repository: B3Repository = Depends(get_b3_repository),
):
    return repository.get_fii_chart_data(ticker.upper(), start_date)


@b3_bp.get("/fiis/{ticker}/date-range")
def get_fii_date_range(ticker: str, repository: B3Repository = Depends(get_b3_repository)):
    result = repository.get_fii_date_range(ticker.upper())
    if not result:
        raise HTTPException(status_code=404, detail=f"Nenhum dado histórico encontrado para {ticker}.")
    return result


@b3_bp.get("/fiis/{ticker}/dividend")
def get_fii_dividend_for_month(
    ticker: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=1900, le=2200),
    repository: B3Repository = Depends(get_b3_repository),
):
    start_date = f"{year:04d}-{month:02d}-01"
    end_date = f"{year:04d}-{month:02d}-{monthrange(year, month)[1]:02d}"
    return repository.get_fii_dividend_for_month(ticker.upper(), start_date, end_date)


@b3_bp.get("/fiis/{ticker}/first-price")
def get_first_fii_price(
    ticker: str,
    oldest_date: str,
    repository: B3Repository = Depends(get_b3_repository),
):
    result = repository.get_first_fii_price(ticker.upper(), oldest_date)
    if not result:
        raise HTTPException(status_code=404, detail="Primeiro preço histórico não encontrado.")
    return result


@b3_bp.get("/prices/closest")
def get_price_closest_to_date(
    ticker: str,
    target_date: str,
    repository: B3Repository = Depends(get_b3_repository),
):
    return repository.get_price_closest_to_date(ticker.upper(), target_date)
