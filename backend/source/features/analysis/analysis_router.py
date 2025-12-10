import pandas as pd
from datetime import datetime
from fastapi import APIRouter, HTTPException
from backend.source.core.db import get_supabase
from backend.source.features.analysis.analysis_schema import SimulationRequest

analysis_bp = APIRouter(prefix="/analysis", tags=["Analysis"])

@analysis_bp.get("/zscore/{ticker}")
def calculate_zscore(ticker: str, window_months: int = 12):
    supabase = get_supabase()

    # 1. Fetch Price History
    response = supabase.table("b3_prices") \
        .select("trade_date,close") \
        .eq("ticker", ticker.upper()) \
        .order("trade_date", desc=True) \
        .limit(window_months * 30 + 100) \
        .execute()

    data = response.data
    if not data:
        raise HTTPException(status_code=404, detail="Ticker not found")

    # 2. Pandas Processing
    df = pd.DataFrame(data)
    df['close'] = pd.to_numeric(df['close'])
    df['trade_date'] = pd.to_datetime(df['trade_date'])
    df = df.sort_values('trade_date', ascending=True)

    # Filter for the requested window
    end_date = df['trade_date'].max()
    start_date = end_date - pd.DateOffset(months=window_months)

    mask = df['trade_date'] >= start_date
    df_window = df.loc[mask].copy()

    if df_window.empty:
        raise HTTPException(status_code=400, detail="Insufficient data for window")

    # 3. Statistical Calculations
    prices = df_window['close']
    current_price = prices.iloc[-1]

    mean = prices.mean()
    std_dev = prices.std(ddof=1) # Sample std dev

    z_score = 0.0
    if std_dev != 0:
        z_score = (current_price - mean) / std_dev

    # Percentile
    days_below = prices[prices <= current_price].count()
    total_days = prices.count()
    percentile = (days_below / total_days) * 100 if total_days > 0 else 0

    # Status Logic
    status = "Neutro"
    if std_dev == 0: status = "Sem variação"
    elif z_score <= -2: status = "🔥 Muito barato (Z ≤ -2)"
    elif z_score <= -1: status = "✅ Barato (−2 < Z ≤ −1)"
    elif z_score < 1: status = "➖ Zona neutra (−1 < Z < 1)"
    elif z_score < 2: status = "⚠️ Caro (1 ≤ Z < 2)"
    else: status = "❌ Muito caro (Z ≥ 2)"

    # Format chart data
    chart_data = df_window[['trade_date', 'close']].rename(columns={'trade_date': 'date'}).to_dict(orient='records')
    for item in chart_data:
        item['date'] = item['date'].strftime('%Y-%m-%d')

    return {
        "ticker": ticker,
        "window_months": window_months,
        "stats": {
            "current": round(current_price, 2),
            "media": round(mean, 2),
            "desvio": round(std_dev, 2),
            "zScore": round(z_score, 2),
            "min": round(prices.min(), 2),
            "max": round(prices.max(), 2),
            "percentile": round(percentile, 1),
            "status": status,
            "totalDays": int(total_days),
            "daysBelowOrEqual": int(days_below)
        },
        "chart_data": chart_data
    }

@analysis_bp.post("/simulation/fii")
def simulate_fii(payload: SimulationRequest):
    supabase = get_supabase()
    ticker = payload.ticker.upper()

    # 1. Fetch Data

    # A. Dividends
    div_resp = supabase.table("b3_fiis_dividends") \
        .select("trade_date,price_close,dividend_value") \
        .eq("ticker", ticker) \
        .order("trade_date", desc=False) \
        .execute()

    if not div_resp.data:
        raise HTTPException(status_code=404, detail="No dividend history found for this ticker")

    df_div = pd.DataFrame(div_resp.data)
    df_div['trade_date'] = pd.to_datetime(df_div['trade_date'])
    df_div['price_close'] = pd.to_numeric(df_div['price_close'])
    df_div['dividend_value'] = pd.to_numeric(df_div['dividend_value'])

    # Filter by requested months
    max_date = df_div['trade_date'].max()
    min_date = max_date - pd.DateOffset(months=payload.months)

    df_sim = df_div[df_div['trade_date'] >= min_date].copy()

    if df_sim.empty:
        raise HTTPException(status_code=400, detail="Requested period exceeds available history")

    start_sim_date = df_sim['trade_date'].min()
    end_sim_date = df_sim['trade_date'].max()

    # B. IPCA (Fetch range)
    ipca_resp = supabase.table("ipca_history") \
        .select("ref_date,ipca") \
        .gte("ref_date", start_sim_date.strftime('%Y-%m-01')) \
        .lte("ref_date", end_sim_date.strftime('%Y-%m-28')) \
        .execute()

    ipca_map = {}
    if ipca_resp.data:
        for row in ipca_resp.data:
            key = row['ref_date'][:7]
            val = float(row['ipca'])
            ipca_map[key] = 1 + (val / 100)

    # 2. Simulation Logic
    initial_inv = payload.initial_investment
    monthly_dep = payload.monthly_deposit

    first_row = df_sim.iloc[0]
    start_price = first_row['price_close']

    shares_reinvest = initial_inv / start_price
    shares_no_reinvest = initial_inv / start_price

    total_invested = initial_inv
    total_divs_withdrawn = 0.0
    inflation_corrected_value = initial_inv

    timeline = []

    # Initial Record
    timeline.append({
        "month": first_row['trade_date'].strftime('%b/%y'),
        "deposit": initial_inv,
        "reinvestStart": 0,
        "reinvestDividends": 0,
        "reinvestEnd": initial_inv,
        "noReinvestStart": 0,
        "noReinvestDividends": 0,
        "noReinvestEnd": initial_inv,
        "difference": 0,
        "currentPrice": start_price,
        "totalInvested": initial_inv,
        "inflationCorrected": initial_inv
    })

    # Iterate subsequent rows
    for i in range(1, len(df_sim)):
        row = df_sim.iloc[i]
        curr_price = row['price_close']
        div_yield_val = row['dividend_value']

        curr_date = row['trade_date']
        prev_date = df_sim.iloc[i-1]['trade_date']

        # IPCA Correction
        prev_month_key = prev_date.strftime('%Y-%m')
        inflation_factor = ipca_map.get(prev_month_key, 1.0)

        inflation_corrected_value = (inflation_corrected_value * inflation_factor) + monthly_dep
        total_invested += monthly_dep

        # --- Scenario 1: Reinvest ---
        start_val_reinvest = shares_reinvest * curr_price
        divs_reinvest = shares_reinvest * div_yield_val

        total_cash_reinvest = monthly_dep + divs_reinvest
        new_shares_reinvest = total_cash_reinvest / curr_price
        shares_reinvest += new_shares_reinvest

        end_val_reinvest = shares_reinvest * curr_price

        # --- Scenario 2: No Reinvest ---
        start_val_no_reinvest = shares_no_reinvest * curr_price
        divs_no_reinvest = shares_no_reinvest * div_yield_val
        total_divs_withdrawn += divs_no_reinvest

        new_shares_no_reinvest = monthly_dep / curr_price
        shares_no_reinvest += new_shares_no_reinvest

        end_val_no_reinvest = shares_no_reinvest * curr_price

        timeline.append({
            "month": curr_date.strftime('%d/%m/%Y'),
            "deposit": monthly_dep,
            "reinvestStart": round(start_val_reinvest, 2),
            "reinvestDividends": round(divs_reinvest, 2),
            "reinvestEnd": round(end_val_reinvest, 2),
            "noReinvestStart": round(start_val_no_reinvest, 2),
            "noReinvestDividends": round(divs_no_reinvest, 2),
            "noReinvestEnd": round(end_val_no_reinvest, 2),
            "difference": round(end_val_reinvest - end_val_no_reinvest, 2),
            "currentPrice": curr_price,
            "totalInvested": round(total_invested, 2),
            "inflationCorrected": round(inflation_corrected_value, 2)
        })

    # Summary Stats
    reinvest_final = shares_reinvest * df_sim.iloc[-1]['price_close']
    no_reinvest_final = shares_no_reinvest * df_sim.iloc[-1]['price_close']

    summary = {
        "totalInvested": round(total_invested, 2),
        "reinvestFinalValue": round(reinvest_final, 2),
        "reinvestTotalGain": round(reinvest_final - total_invested, 2),
        "noReinvestFinalValue": round(no_reinvest_final, 2),
        "totalDividendsWithdrawn": round(total_divs_withdrawn, 2),
        "noReinvestTotalGain": round((no_reinvest_final + total_divs_withdrawn) - total_invested, 2)
    }

    return {
        "summary": summary,
        "timeline": timeline,
        "period_text": f"({len(df_sim)} meses: {start_sim_date.strftime('%d/%m/%Y')} a {end_sim_date.strftime('%d/%m/%Y')})"
    }