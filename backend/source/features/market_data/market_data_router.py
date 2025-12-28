# backend/source/features/market_data/market_data_router.py

import base64
import io
import json
import re
import unicodedata
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd
import requests
import yfinance as yf
from fastapi import APIRouter, HTTPException

# Certifique-se que estes imports existem no seu projeto
from backend.source.core.db import get_supabase
from backend.source.features.market_data.market_data_constants import ASSET_SCHEMA
from backend.source.features.market_data.market_data_schemas import TickerSync

market_data_bp = APIRouter(prefix="/sync", tags=["Market Data"])

# ==============================================================================
# 1. CONFIGURAÇÕES E CONSTANTES DE CLASSIFICAÇÃO (CÓDIGO NOVO)
# ==============================================================================

CLASSIFICATION_CACHE_TABLE = "asset_classification_cache"
CLASSIFICATION_CACHE_TTL_DAYS = 30

# Overrides manuais
CLASSIFICATION_OVERRIDES: Dict[str, Dict[str, str]] = {
    "KNCR11": {
        "detected_type": "FII - Papel (CRI)",
        "sector": "papel",
        "reasoning": "Override: Fundo majoritariamente de CRI."
    },
    "KNHF11": {
        "detected_type": "FII - Híbrido",
        "sector": "híbrido",
        "reasoning": "Override: Multiestratégia Kinea."
    },
    "MXRF11": {
        "detected_type": "FII - Híbrido",
        "sector": "híbrido",
        "reasoning": "Override: Fundo misto (Papel + Permutas + FIIs)."
    },
    "TGAR11": {
        "detected_type": "FII - Desenvolvimento",
        "sector": "desenvolvimento",
        "reasoning": "Override: Fundo de desenvolvimento imobiliário."
    },
    "HGLG11": {
        "detected_type": "FII - Tijolo (Logística)",
        "sector": "tijolo",
        "reasoning": "Override: Referência em logística."
    },
    "IVVB11": {
        "detected_type": "ETF - Internacional (S&P 500)",
        "sector": "ETF - Base Global",
        "reasoning": "Override: ETF S&P 500."
    },
    "QQQQ11": {
        "detected_type": "ETF - Tech (Nasdaq)",
        "sector": "ETF - Específicos",
        "reasoning": "Override: ETF Nasdaq 100."
    }
}

# Regex Patterns
P_DEV = [re.compile(r"\bdesenvolvimento\b"), re.compile(r"\bincorporac\w*\b"), re.compile(r"\bpermuta\b"),
         re.compile(r"\bloteamento\b"), re.compile(r"\bganho\s+de\s+capital\b"), re.compile(r"\blandbank\b"),
         re.compile(r"\bconstruc\w*\b"), re.compile(r"\bvenda\b")]
P_CRI = [re.compile(r"\bcri\b"), re.compile(r"\bcr[i|s]\b"), re.compile(r"certificad(?:o|os)\s+de\s+recebiveis"),
         re.compile(r"\brecebiveis?\s+imobiliarios?\b"), re.compile(r"\btitulos?\s+de\s+credito\b"),
         re.compile(r"\bipca\b"), re.compile(r"\bcdi\b"), re.compile(r"\bhigh\s+yield\b"),
         re.compile(r"\bhigh\s+grade\b")]
P_FOF = [re.compile(r"\bfundo\s+de\s+fundos\b"), re.compile(r"\bfof\b"),
         re.compile(r"\bcotas?\s+de\s+(outros\s+)?fundos?\b"), re.compile(r"\bquis\b")]
P_MULTI = [re.compile(r"\bmultiestrategi\w*\b"), re.compile(r"\bmultistrateg\w*\b"), re.compile(r"\bdiversificad\w*\b"),
           re.compile(r"\bgestao\s+ativa\b"), re.compile(r"\bhibrid\w*\b"), re.compile(r"\bmixed\b")]
P_TIJOLO_GERAL = [re.compile(r"\blogistic\w*\b"), re.compile(r"\bgalpa\w*\b"), re.compile(r"\barmaz\w*\b"),
                  re.compile(r"\bshopping\b"), re.compile(r"\bmall\w*\b"), re.compile(r"\bvarej\w*\b"),
                  re.compile(r"\blajes?\b"), re.compile(r"\bescritor\w*\b"), re.compile(r"\bcorporativ\w*\b"),
                  re.compile(r"\bcorporate\b"), re.compile(r"\boffice\b"), re.compile(r"\brenda\s+urbana\b"),
                  re.compile(r"\bedifici\w*\b"), re.compile(r"\bimoveis?\b"), re.compile(r"\bimobiliari\w*\b"),
                  re.compile(r"\breal\s+estate\b"), re.compile(r"\bpredio\b"), re.compile(r"\bhospital\b"),
                  re.compile(r"\beducacional\b")]
P_FIAGRO = [re.compile(r"\bfiagro\b"), re.compile(r"\bcra\b"), re.compile(r"\bagronegoc\w*\b"),
            re.compile(r"\bfarmland\b"), re.compile(r"\bterra\b")]


# ==============================================================================
# 2. HELPER FUNCTIONS (MISTURA DE NOVO + ANTIGO ROBUSTO)
# ==============================================================================

def _norm(s: str) -> str:
    """Lowercase + remove accents + keep alnum/space only."""
    if not s: return ""
    s = str(s).lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _score(text: str, patterns: List[re.Pattern]) -> int:
    return sum(1 for p in patterns if p.search(text))


def _safe_parse_iso(dt_str: str) -> Optional[datetime]:
    if not dt_str: return None
    try:
        s = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _looks_like_etf(text: str, quote_type: str) -> bool:
    if quote_type == "etf": return True
    if re.search(r"\b(etf|fundo\s+de\s+indice|exchange\s+traded\s+fund)\b", text): return True
    return False


def _looks_like_fii(ticker_up: str, text: str, quote_type: str) -> bool:
    if _looks_like_etf(text, quote_type): return False
    if re.search(r"\b(fii|fundo\s+de\s+investimento\s+imobiliario|fdo\s+inv\s+imob)\b", text): return True
    if "reit" in quote_type: return True
    if ticker_up.endswith("11"): return True
    return False


def _confidence_from_scores(is_fii: bool, is_etf: bool, quote_type: str, scores: Dict[str, int],
                            matched_override: bool) -> int:
    if matched_override: return 99
    base = 35
    if is_fii: base += 20
    if is_etf: base += 20
    if quote_type in ("etf", "equity"): base += 10
    total_matches = sum(scores.values())
    base += min(20, total_matches * 5)
    return max(5, min(95, base))


def _get_cache(supabase, ticker_up: str) -> Optional[Dict[str, Any]]:
    try:
        resp = supabase.table(CLASSIFICATION_CACHE_TABLE).select("*").eq("ticker", ticker_up).limit(1).execute()
        if not resp.data: return None
        row = resp.data[0]
        updated_at = _safe_parse_iso(row.get("updated_at") or row.get("inserted_at") or "")
        if not updated_at or updated_at < (
                datetime.now(updated_at.tzinfo) - timedelta(days=CLASSIFICATION_CACHE_TTL_DAYS)):
            return None
        return row
    except Exception:
        return None


def _upsert_cache(supabase, row: Dict[str, Any]) -> None:
    try:
        row["updated_at"] = datetime.now().isoformat()
        supabase.table(CLASSIFICATION_CACHE_TABLE).upsert(row, on_conflict="ticker").execute()
    except Exception as e:
        print(f"⚠️ Cache upsert failed: {e}")


def normalize_yahoo_robust(df: pd.DataFrame) -> pd.DataFrame:
    """
    Versão robusta do código antigo para normalizar dados do Yahoo.
    """
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

    # Trata MultiIndex do Yahoo
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.loc[:, ~df.columns.duplicated()]

    try:
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    except Exception:
        pass

    required = {"date", "open", "high", "low", "close", "volume"}
    for req in required:
        if req not in df.columns:
            if req == 'volume':
                df['volume'] = 0
            else:
                # Se faltar coluna essencial, não serve
                return pd.DataFrame()

    return df[list(required)]


# ==============================================================================
# 3. ROTAS DE SINCRONIZAÇÃO (INTEGRAÇÃO DE FUNCIONALIDADES)
# ==============================================================================

@market_data_bp.get("/constants")
def get_market_constants():
    """Retorna o contrato de categorias disponíveis para o Frontend."""
    return ASSET_SCHEMA


@market_data_bp.post("/")
def sync_ticker(payload: TickerSync):
    """
    Sincroniza histórico (OHLCV) via Yahoo Finance.
    CORRIGIDO: Aponta para a tabela antiga 'b3_prices' e coluna 'trade_date'.
    """
    ticker = payload.ticker
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    # Lógica de datas (5 anos)
    end_date = datetime.now() + timedelta(days=1)
    start_date = end_date - timedelta(days=365 * 5)

    yf_ticker = f"{ticker}.SA" if not ticker.endswith(".SA") else ticker
    clean_ticker = ticker.replace(".SA", "").upper()

    print(f"📡 Downloading {yf_ticker}...", flush=True)

    try:
        # Download Yahoo
        df_raw = yf.download(
            yf_ticker,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            auto_adjust=False,
            progress=False
        )

        if df_raw.empty:
            raise HTTPException(status_code=404, detail="Yahoo returned no data")

        df_norm = normalize_yahoo_robust(df_raw)

        if df_norm.empty:
            raise HTTPException(status_code=422, detail="Data downloaded but failed normalization.")

        supabase = get_supabase()

        records = []
        current_time = datetime.now().isoformat()

        for _, row in df_norm.iterrows():
            records.append({
                "ticker": clean_ticker,
                "trade_date": row["date"],  # <--- VOLTOU PARA 'trade_date' (compatível com b3_prices)
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"]),
                "inserted_at": current_time
            })

        # Batch Insert
        BATCH_SIZE = 1000
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i:i + BATCH_SIZE]

            # <--- CORREÇÃO PRINCIPAL AQUI: Volta para 'b3_prices'
            response = supabase.table("b3_prices").upsert(
                batch,
                on_conflict="ticker,trade_date"
            ).execute()

        return {
            "success": True,
            "count": len(records),
            "message": f"Successfully synced {len(records)} records for {ticker}"
        }

    except Exception as e:
        print(f"❌ Error syncing ticker: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@market_data_bp.post("/ifix")
def sync_ifix():
    """
    Syncs IFIX directly from B3 website (Official Source).
    Lógica recuperada do código antigo (Scraper B3).
    """
    print("📡 Downloading IFIX data directly from B3 (Official Source)...", flush=True)

    try:
        current_year = str(datetime.now().year)
        payload_data = {"index": "IFIX", "language": "pt-br", "year": current_year}

        json_str = json.dumps(payload_data, separators=(',', ':'))
        b64_payload = base64.b64encode(json_str.encode()).decode()
        url = f"https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetDownloadPortfolioDay/{b64_payload}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        csv_content = base64.b64decode(response.content).decode("iso-8859-1")
        df = pd.read_csv(io.StringIO(csv_content), sep=";", skiprows=1)
        df = df[pd.to_numeric(df['Dia'], errors='coerce').notnull()]

        month_cols = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
        available_months = [m for m in month_cols if m in df.columns]

        df_melted = df.melt(id_vars=["Dia"], value_vars=available_months, var_name="Month", value_name="Value")
        df_melted = df_melted.dropna(subset=["Value"])
        df_melted = df_melted[df_melted["Value"] != ""]

        month_map = {
            "Jan": "01", "Fev": "02", "Mar": "03", "Abr": "04", "Mai": "05", "Jun": "06",
            "Jul": "07", "Ago": "08", "Set": "09", "Out": "10", "Nov": "11", "Dez": "12"
        }

        records = []
        for _, row in df_melted.iterrows():
            day = str(row["Dia"]).zfill(2)
            month_num = month_map.get(row["Month"])
            trade_date = f"{current_year}-{month_num}-{day}"

            raw_val = str(row["Value"])
            clean_val = raw_val.replace(".", "").replace(",", ".")
            final_val = float(clean_val)

            records.append({
                "trade_date": trade_date,
                "close_value": final_val
            })

        records.sort(key=lambda x: x['trade_date'])

        if not records:
            raise HTTPException(status_code=404, detail="B3 returned data, but no valid records parsed.")

        # Safety Block & Insert
        supabase = get_supabase()
        supabase.table("ifix_history").upsert(records, on_conflict="trade_date").execute()

        return {"success": True, "count": len(records), "message": "Synced IFIX from B3"}

    except Exception as e:
        print(f"❌ Error syncing IFIX: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@market_data_bp.post("/ibov")
def sync_ibov():
    """
    Syncs IBOVESPA directly from B3 website (Official Source).
    Lógica recuperada do código antigo.
    """
    print("📡 Downloading IBOVESPA data directly from B3...", flush=True)

    try:
        current_year = str(datetime.now().year)
        payload_data = {"index": "IBOVESPA", "language": "pt-br", "year": current_year}

        json_str = json.dumps(payload_data, separators=(',', ':'))
        b64_payload = base64.b64encode(json_str.encode()).decode()
        url = f"https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetDownloadPortfolioDay/{b64_payload}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        csv_content = base64.b64decode(response.content).decode("iso-8859-1")
        df = pd.read_csv(io.StringIO(csv_content), sep=";", skiprows=1)
        df = df[pd.to_numeric(df['Dia'], errors='coerce').notnull()]

        month_cols = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
        available_months = [m for m in month_cols if m in df.columns]

        df_melted = df.melt(id_vars=["Dia"], value_vars=available_months, var_name="Month", value_name="Value")
        df_melted = df_melted.dropna(subset=["Value"])
        df_melted = df_melted[df_melted["Value"] != ""]

        month_map = {
            "Jan": "01", "Fev": "02", "Mar": "03", "Abr": "04", "Mai": "05", "Jun": "06",
            "Jul": "07", "Ago": "08", "Set": "09", "Out": "10", "Nov": "11", "Dez": "12"
        }

        records = []
        for _, row in df_melted.iterrows():
            day = str(row["Dia"]).zfill(2)
            month_num = month_map.get(row["Month"])
            trade_date = f"{current_year}-{month_num}-{day}"

            raw_val = str(row["Value"])
            clean_val = raw_val.replace(".", "").replace(",", ".")
            final_val = float(clean_val)

            records.append({
                "trade_date": trade_date,
                "close_value": final_val
            })

        records.sort(key=lambda x: x['trade_date'])

        if not records:
            raise HTTPException(status_code=404, detail="B3 returned data, but no valid records parsed.")

        supabase = get_supabase()
        supabase.table("ibov_history").upsert(records, on_conflict="trade_date").execute()

        return {"success": True, "count": len(records), "message": "Synced IBOV from B3"}

    except Exception as e:
        print(f"❌ Error syncing IBOV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@market_data_bp.post("/cdi")
def sync_cdi():
    """
    Syncs CDI history using BCB Series 11 (Daily Selic).
    Lógica recuperada do código antigo (BCB API).
    """
    BCB_BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados"
    print("📡 Downloading CDI (Selic) data from BCB...", flush=True)

    try:
        supabase = get_supabase()

        # Check DB for most recent date
        last_row = supabase.table("cdi_history") \
            .select("trade_date") \
            .order("trade_date", desc=True) \
            .limit(1) \
            .execute()

        today = datetime.now()

        if last_row.data:
            last_date_str = last_row.data[0]['trade_date']
            last_date_obj = datetime.strptime(last_date_str, "%Y-%m-%d")
            start_date_obj = last_date_obj + timedelta(days=1)
        else:
            start_date_obj = today - timedelta(days=365 * 10)

        data_inicial = start_date_obj.strftime("%d/%m/%Y")
        data_final = today.strftime("%d/%m/%Y")

        if start_date_obj > today:
            return {"success": True, "count": 0, "message": "CDI already up to date."}

        params = {"formato": "json", "dataInicial": data_inicial, "dataFinal": data_final}
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

        print(f"   ↳ Requesting range: {data_inicial} to {data_final}")
        response = requests.get(BCB_BASE_URL, headers=headers, params=params)
        response.raise_for_status()

        data = response.json()
        if isinstance(data, dict) and "error" in data:
            raise HTTPException(status_code=400, detail=f"BCB API Error: {data['error']}")

        records = []
        for entry in data:
            if 'data' not in entry or 'valor' not in entry: continue
            day, month, year = entry['data'].split('/')
            iso_date = f"{year}-{month}-{day}"
            val_float = float(entry['valor'].replace(',', '.'))

            records.append({"trade_date": iso_date, "value": val_float})

        if not records:
            return {"success": True, "count": 0, "message": "No new data found."}

        # Batch Insert
        BATCH_SIZE = 1000
        total_inserted = 0
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i:i + BATCH_SIZE]
            supabase.table("cdi_history").upsert(batch, on_conflict="trade_date").execute()
            total_inserted += len(batch)

        return {"success": True, "count": total_inserted, "message": f"Synced {total_inserted} records."}

    except Exception as e:
        print(f"❌ Error syncing CDI: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# 4. ROTA DE CLASSIFICAÇÃO (CÓDIGO NOVO - MANTIDO)
# ==============================================================================

@market_data_bp.post("/classify")
def classify_ticker(payload: TickerSync):
    """
    Classifica o ativo (FII, ETF ou Ação) com heurísticas e regex.
    """
    ticker = payload.ticker
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker required")

    ticker_up = ticker.upper().replace(".SA", "")
    yf_ticker = f"{ticker_up}.SA"
    print(f"📡 Classifying {yf_ticker}...", flush=True)

    base_result: Dict[str, Any] = {
        "ticker": ticker_up,
        "detected_type": "Indefinido",
        "reasoning": "Não foi possível identificar padrões claros",
        "sector": "Outros",
        "quote_type": "unknown",
        "confidence": 10,
        "raw_info_sample": "Sem descrição",
        "source": "heuristic+yahoo",
        "updated_at": datetime.now().isoformat(),
    }

    try:
        supabase = get_supabase()

        # 1) OVERRIDES
        if ticker_up in CLASSIFICATION_OVERRIDES:
            ov = CLASSIFICATION_OVERRIDES[ticker_up]
            base_result.update(ov)
            base_result["confidence"] = _confidence_from_scores(False, False, "unknown", {}, True)
            base_result["source"] = "override"
            _upsert_cache(supabase, base_result)
            return base_result

        # 2) CACHE
        cached = _get_cache(supabase, ticker_up)
        if cached:
            return {
                "ticker": cached.get("ticker", ticker_up),
                "detected_type": cached.get("detected_type", "Indefinido"),
                "reasoning": cached.get("reasoning", "cache"),
                "sector": cached.get("sector", "Outros"),
                "quote_type": cached.get("quote_type", "unknown"),
                "confidence": cached.get("confidence", 50),
                "raw_info_sample": cached.get("raw_info_sample", ""),
                "source": cached.get("source", "cache"),
                "updated_at": cached.get("updated_at"),
            }

        # 3) YAHOO FETCH
        asset = yf.Ticker(yf_ticker)
        info = asset.info or {}

        summary = str(info.get("longBusinessSummary") or "")
        short_name = str(info.get("shortName") or "")
        long_name = str(info.get("longName") or "")
        sector_y = str(info.get("sector") or "")
        quote_type = str(info.get("quoteType") or "")
        category = str(info.get("category") or "")

        base_result["quote_type"] = quote_type or "unknown"
        base_result["raw_info_sample"] = (summary[:100] + "...") if summary else "Sem descrição"

        text = _norm(f"{summary} {short_name} {long_name} {category}")
        qtype_n = _norm(quote_type)

        # 4) SCORING
        looks_etf = _looks_like_etf(text, qtype_n)
        looks_fii = _looks_like_fii(ticker_up, text, qtype_n)

        s_cri = _score(text, P_CRI)
        s_fof = _score(text, P_FOF)
        s_multi = _score(text, P_MULTI)
        s_dev = _score(text, P_DEV)
        s_tijolo = _score(text, P_TIJOLO_GERAL)
        s_fiagro = _score(text, P_FIAGRO)

        scores = {"cri": s_cri, "fof": s_fof, "multi": s_multi, "dev": s_dev, "tijolo": s_tijolo, "fiagro": s_fiagro}

        # 5) CLASSIFICATION LOGIC
        # === FIIs ===
        if looks_fii:
            is_fiagro = s_fiagro >= 1
            is_fof = s_fof >= 1 or "fundo de fundos" in text
            is_dev = s_dev >= 2
            is_cri = s_cri >= 1
            is_tijolo = s_tijolo >= 1
            is_multi = s_multi >= 1

            if is_fiagro:
                base_result["sector"] = "papel"
                base_result["detected_type"] = "Fiagro"
                base_result["reasoning"] = f"Fiagro detectado (score={s_fiagro})."
            elif is_fof:
                base_result["sector"] = "fundos de fundos"
                base_result["detected_type"] = "FII - Fundo de Fundos"
                base_result["reasoning"] = f"FoF detectado (score={s_fof})."
            elif is_dev and not is_cri:
                base_result["sector"] = "desenvolvimento"
                base_result["detected_type"] = "FII - Desenvolvimento"
                base_result["reasoning"] = f"Termos de incorporação (score={s_dev})."
            elif is_multi:
                base_result["sector"] = "híbrido"
                base_result["detected_type"] = "FII - Multiestratégia"
                base_result["reasoning"] = f"Termos de multiestratégia (score={s_multi})."
            elif (is_cri and is_tijolo):
                if s_tijolo > s_cri:
                    base_result["sector"] = "tijolo"
                    base_result["detected_type"] = f"FII - Tijolo (Geral)"
                    base_result["reasoning"] = f"Tijolo predominante ({s_tijolo} vs {s_cri})."
                else:
                    base_result["sector"] = "híbrido"
                    base_result["detected_type"] = "FII - Híbrido (Misto)"
                    base_result["reasoning"] = f"Mix de Papel e Tijolo equilibrado."
            elif is_cri:
                base_result["sector"] = "papel"
                base_result["detected_type"] = "FII - Papel (CRI)"
                base_result["reasoning"] = f"Foco em recebíveis (score={s_cri})."
            elif is_tijolo:
                base_result["sector"] = "tijolo"
                sub = "Geral"
                if "logistic" in text:
                    sub = "Logística"
                elif "shopping" in text:
                    sub = "Shopping"
                elif "laje" in text or "office" in text:
                    sub = "Lajes"
                base_result["detected_type"] = f"FII - Tijolo ({sub})"
                base_result["reasoning"] = f"Fundo de Imóveis (score={s_tijolo})."
            else:
                base_result["sector"] = "híbrido"
                base_result["detected_type"] = "FII - Indefinido"
                base_result["reasoning"] = "FII sem estratégia clara."

            base_result["confidence"] = _confidence_from_scores(True, False, qtype_n, scores, False)
            _upsert_cache(supabase, base_result)
            return base_result

        # === ETFs ===
        if looks_etf:
            base_result["sector"] = "etf"
            is_global = any(x in text for x in ["sp 500", "s&p 500", "msci", "world"])
            is_br = any(x in text for x in ["ibovespa", "ibov"])
            if is_global:
                base_result["detected_type"] = "ETF - Internacional"
                base_result["reasoning"] = "Índice Global."
            elif is_br:
                base_result["detected_type"] = "ETF - Brasil"
                base_result["reasoning"] = "Índice Brasil."
            elif "crypto" in text or "bitcoin" in text:
                base_result["detected_type"] = "ETF - Cripto"
                base_result["reasoning"] = "Criptoativos."
            else:
                base_result["detected_type"] = "ETF - Temático/Outros"
                base_result["reasoning"] = "ETF Específico."

            base_result["confidence"] = _confidence_from_scores(False, True, qtype_n, scores, False)
            _upsert_cache(supabase, base_result)
            return base_result

        # === AÇÕES ===
        if "equity" in qtype_n:
            sector_n = _norm(sector_y)
            sector_map = {
                "financial services": "Financeiro", "basic materials": "Materiais Básicos",
                "utilities": "Utilidade Pública",
                "energy": "Energia", "consumer defensive": "Consumo Não-Cíclico",
                "consumer cyclical": "Consumo Cíclico",
                "industrials": "Industrial", "technology": "Tecnologia", "healthcare": "Saúde",
                "real estate": "Imobiliário",
                "communication services": "Comunicações"
            }
            translated_sector = sector_map.get(sector_n, sector_y.capitalize() if sector_y else "Geral")
            STRATEGY_PERENE = ["Financeiro", "Utilidade Pública", "Energia", "Consumo Não-Cíclico", "Saúde",
                               "Imobiliário"]
            macro_strategy = "Perenes (Renda/Defesa)" if translated_sector in STRATEGY_PERENE else "Cíclicas (Valor/Crescimento)"

            base_result["sector"] = macro_strategy
            base_result["detected_type"] = f"Ação - {translated_sector}"
            base_result["reasoning"] = f"Setor Yahoo: {sector_y} -> {macro_strategy}"
            base_result["confidence"] = 80
            _upsert_cache(supabase, base_result)
            return base_result

        # Fallback
        base_result["sector"] = "outros"
        base_result["reasoning"] = f"Não classificado. Type={quote_type}"
        _upsert_cache(supabase, base_result)
        return base_result

    except Exception as e:
        print(f"❌ Error classifying: {e}")
        return {
            "ticker": ticker_up, "detected_type": "Erro", "sector": "erro",
            "reasoning": str(e), "confidence": 0, "source": "error",
            "updated_at": datetime.now().isoformat()
        }