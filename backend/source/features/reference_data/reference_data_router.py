import requests
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.source.core.dependencies import get_reference_data_repository
from backend.source.features.reference_data.bcb_sgs_client import (
    default_date_range,
    fetch_series,
    parse_series_date,
)
from backend.source.persistence.ports import ReferenceDataRepository


reference_data_bp = APIRouter(prefix="/data", tags=["Reference Data"])


@reference_data_bp.get("/ipca")
def get_ipca(
    ref_date: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    repository: ReferenceDataRepository = Depends(get_reference_data_repository),
):
    return repository.get_ipca(ref_date=ref_date, start_date=start_date, end_date=end_date)


@reference_data_bp.get("/ipca/last")
def get_last_ipca_date(repository: ReferenceDataRepository = Depends(get_reference_data_repository)):
    return {"ref_date": repository.get_last_ipca_date()}


@reference_data_bp.get("/ifix")
def get_ifix(
    date: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    repository: ReferenceDataRepository = Depends(get_reference_data_repository),
):
    return repository.get_ifix(date=date, start_date=start_date, end_date=end_date)


@reference_data_bp.get("/ibov")
def get_ibov(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    repository: ReferenceDataRepository = Depends(get_reference_data_repository),
):
    return repository.get_ibov(start_date=start_date, end_date=end_date)


@reference_data_bp.get("/ibov/last")
def get_last_ibov_date(repository: ReferenceDataRepository = Depends(get_reference_data_repository)):
    return {"trade_date": repository.get_last_ibov_date()}


@reference_data_bp.get("/cdi")
def get_cdi(
    start_date: str,
    end_date: str,
    repository: ReferenceDataRepository = Depends(get_reference_data_repository),
):
    return repository.get_cdi(start_date, end_date)


@reference_data_bp.post("/ipca/sync")
def sync_ipca(repository: ReferenceDataRepository = Depends(get_reference_data_repository)):
    try:
        start_date, end_date = default_date_range()
        data = fetch_series(433, start_date, end_date)
        last_date = repository.get_last_ipca_date()
        records = [
            {
                "ref_date": parse_series_date(row["data"]),
                "ipca": float(row["valor"].replace(",", ".")),
            }
            for row in data
            if row.get("data") and row.get("valor")
        ]
        if last_date:
            records = [row for row in records if row["ref_date"] > last_date]
        repository.insert_ipca(records)
        return {
            "success": True,
            "inserted": len(records),
            "from": records[0]["ref_date"] if records else None,
            "to": records[-1]["ref_date"] if records else None,
            "message": f"IPCA sincronizado: {len(records)} registros.",
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Falha ao sincronizar IPCA: {exc}") from exc
