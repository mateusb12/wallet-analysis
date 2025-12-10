import os
from datetime import datetime, timedelta

import requests
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


@market_data_bp.post("/cdi")
def sync_cdi():
    """
    Syncs CDI history using BCB Series 11 (Daily Selic).
    Smart Sync: Resumes from the last database date to avoid BCB 10-year limit errors.
    """
    # Base URL (without parameters)
    BCB_BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados"

    print("📡 Downloading CDI (Selic) data from BCB...", flush=True)

    try:
        supabase = get_supabase()

        # 1. Determine Start Date
        # Check DB for the most recent date we already have
        last_row = supabase.table("cdi_history") \
            .select("trade_date") \
            .order("trade_date", desc=True) \
            .limit(1) \
            .execute()

        today = datetime.now()

        if last_row.data:
            # We have data, resume from the next day
            last_date_str = last_row.data[0]['trade_date']
            last_date_obj = datetime.strptime(last_date_str, "%Y-%m-%d")
            start_date_obj = last_date_obj + timedelta(days=1)
        else:
            # No data (first sync), default to 10 years ago (API limit)
            start_date_obj = today - timedelta(days=365 * 10)

        # 2. Prepare Parameters (dd/mm/yyyy)
        data_inicial = start_date_obj.strftime("%d/%m/%Y")
        data_final = today.strftime("%d/%m/%Y")

        # If start date is in the future (already up to date), stop here
        if start_date_obj > today:
            return {"success": True, "count": 0, "message": "CDI already up to date."}

        params = {
            "formato": "json",
            "dataInicial": data_inicial,
            "dataFinal": data_final
        }

        # 3. Fetch Data with Headers and Date Range
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }

        print(f"   ↳ Requesting range: {data_inicial} to {data_final}")
        response = requests.get(BCB_BASE_URL, headers=headers, params=params)
        response.raise_for_status()

        data = response.json()

        # Guard: Check if API returned an error object instead of a list
        if isinstance(data, dict) and "error" in data:
            print(f"⚠️ BCB API Error: {data['error']}")
            raise HTTPException(status_code=400, detail=f"BCB API Error: {data['error']}")

        # 4. Process Records
        records = []
        for entry in data:
            # Safe access
            if 'data' not in entry or 'valor' not in entry:
                continue

            # BCB format "dd/mm/yyyy" -> ISO "yyyy-mm-dd"
            day, month, year = entry['data'].split('/')
            iso_date = f"{year}-{month}-{day}"

            # BCB value "0,042321" -> float
            val_str = entry['valor'].replace(',', '.')
            val_float = float(val_str)

            records.append({
                "trade_date": iso_date,
                "value": val_float
            })

        if not records:
            return {"success": True, "count": 0, "message": "No new data found."}

        # 5. Batch Insert (Chunking)
        BATCH_SIZE = 1000
        total_inserted = 0

        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i:i + BATCH_SIZE]
            supabase.table("cdi_history").upsert(batch, on_conflict="trade_date").execute()
            total_inserted += len(batch)

        return {
            "success": True,
            "count": total_inserted,
            "message": f"Synced {total_inserted} records from {data_inicial}."
        }

    except Exception as e:
        print(f"❌ Error syncing CDI: {e}")
        # import traceback; traceback.print_exc() # Uncomment for deep debugging
        raise HTTPException(status_code=500, detail=str(e))