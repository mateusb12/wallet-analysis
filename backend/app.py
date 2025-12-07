import os
import pandas as pd
import yfinance as yf
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, timedelta

# Load env from the root of your project (one level up)
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

app = Flask(__name__)
# Enable CORS so your React app (localhost:5173) can talk to this server
CORS(app)

# --- Helper Functions (Your original logic) ---

def normalize_yahoo(df):
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

    # Clean duplicates
    df = df.loc[:, ~df.columns.duplicated()]

    try:
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    except Exception:
        raise ValueError("Could not parse 'date' column.")

    required = {"date", "open", "high", "low", "close", "volume"}
    # Ensure all required columns exist
    for req in required:
        if req not in df.columns:
            # Fallback if volume is missing (rare but possible)
            if req == 'volume': df['volume'] = 0
            else: raise ValueError(f"Missing column: {req}")

    return df[list(required)]

# --- Routes ---

@app.route('/sync', methods=['POST'])
def sync_ticker():
    data = request.json
    ticker = data.get('ticker')

    if not ticker:
        return jsonify({"success": False, "error": "Ticker is required"}), 400

    # Default to last 60 days if not provided
    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)

    yf_ticker = f"{ticker.upper()}.SA"
    print(f"📡 Downloading {yf_ticker}...", flush=True)

    try:
        # Download Data
        df_raw = yf.download(
            yf_ticker,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            auto_adjust=False,
            progress=False
        )

        if df_raw.empty:
            return jsonify({"success": False, "error": "Yahoo returned no data. Check if ticker exists."}), 404

        df_norm = normalize_yahoo(df_raw)

        # Connect to Supabase
        supa_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
        supa_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")

        if not supa_url or not supa_key:
            return jsonify({"success": False, "error": "Supabase credentials missing in .env"}), 500

        supabase: Client = create_client(supa_url, supa_key)

        # Prepare Payload
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

        # Bulk Upsert
        print(f"✨ Upserting {len(records)} rows to Supabase...", flush=True)
        response = supabase.table("b3_prices").upsert(
            records,
            on_conflict="ticker,trade_date"
        ).execute()

        return jsonify({
            "success": True,
            "count": len(records),
            "message": f"Successfully synced {len(records)} records for {ticker}"
        })

    except Exception as e:
        print(f"❌ Error: {e}", flush=True)
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Running on 0.0.0.0 allows access from other devices if needed, default port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)