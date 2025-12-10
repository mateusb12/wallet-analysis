import os
from datetime import datetime, timedelta
import yfinance as yf
import pandas as pd
from fastapi import APIRouter, HTTPException
from supabase import Client, create_client

# Corrected absolute import
from backend.source.core.db import get_supabase
from backend.source.features.market_data.market_data_schemas import TickerSync

market_data_bp = APIRouter(prefix="/sync", tags=["Market Data"])

def normalize_yahoo(df):
    """Helper to normalize Yahoo Finance DataFrame columns."""
    df = df.copy()
    df.reset_index(inplace=True)
    df.columns = [str(col).lower().strip().replace(" ", "") for col in df.columns]

    rename_map = {}
    for col in list(df.columns):
        col_str = str(col).lower()
        if "adj" in col_str: continue
        if "open" in col_str: rename_map[col] = "open"
        if "high" in col_str: rename_map[col] = "high"
        if "low" in col_str: rename_map[col] = "low"
        if "close" in col_str: rename_map[col] = "close"
        if "volume" in col_str: rename_map[col] = "volume"
        if "date" in col_str: rename_map[col] = "date"

    df = df.rename(columns=lambda c: rename_map.get(c, c))

    if "date" not in df.columns and "index" in df.columns:
        df.rename(columns={'index': 'date'}, inplace=True)

    # Handle multi-index columns if yahoo returns them
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.loc[:, ~df.columns.duplicated()]

    try:
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    except Exception:
        raise ValueError("Could not parse 'date' column.")

    required = {"date", "open", "high", "low", "close", "volume"}
    for req in required:
        if req not in df.columns:
            if req == 'volume': df['volume'] = 0
            else: raise ValueError(f"Missing column: {req}")

    return df[list(required)]

@market_data_bp.post("/")
def sync_ticker(payload: TickerSync):
    ticker = payload.ticker
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)
    yf_ticker = f"{ticker.upper()}.SA"

    print(f"📡 Downloading {yf_ticker}...", flush=True)

    try:
        df_raw = yf.download(
            yf_ticker,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            auto_adjust=False,
            progress=False
        )

        if df_raw.empty:
            raise HTTPException(status_code=404, detail="Yahoo returned no data")

        df_norm = normalize_yahoo(df_raw)

        # Use the standard get_supabase helper
        supabase = get_supabase()

        records = []
        current_time = datetime.now().isoformat()

        for _, row in df_norm.iterrows():
            records.append({
                "ticker": ticker.upper(),
                "trade_date": row["date"],
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"]),
                "inserted_at": current_time
            })

        response = supabase.table("b3_prices").upsert(
            records,
            on_conflict="ticker,trade_date"
        ).execute()

        return {
            "success": True,
            "count": len(records),
            "message": f"Successfully synced {len(records)} records for {ticker}"
        }

    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@market_data_bp.post("/ifix")
def sync_ifix(payload: TickerSync):
    ticker = payload.ticker
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)
    yf_ticker = f"{ticker.upper()}.SA"

    print(f"📡 Downloading IFIX data from {yf_ticker}...", flush=True)

    try:
        df_raw = yf.download(
            yf_ticker,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            auto_adjust=False,
            progress=False
        )

        if df_raw.empty:
            raise HTTPException(status_code=404, detail="Yahoo returned no data")

        df_norm = normalize_yahoo(df_raw)

        supabase = get_supabase()

        records = []
        for _, row in df_norm.iterrows():
            records.append({
                "trade_date": row["date"],
                "close_value": float(row["close"]),
            })

        response = supabase.table("ifix_history").upsert(
            records,
            on_conflict="trade_date"
        ).execute()

        return {
            "success": True,
            "count": len(records),
            "message": f"Successfully synced {len(records)} IFIX records using {ticker}"
        }

    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))