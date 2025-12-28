# backend/source/features/market_data/market_data_router.py

import base64
import io
import json
import re
import unicodedata
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests
import yfinance as yf
from fastapi import APIRouter, HTTPException

from backend.source.core.db import get_supabase
from backend.source.features.market_data.market_data_constants import ASSET_SCHEMA
from backend.source.features.market_data.market_data_schemas import TickerSync

market_data_bp = APIRouter(prefix="/sync", tags=["Market Data"])

# -----------------------------------------------------------------------------
# CONFIGURAÇÃO DE CACHE E OVERRIDES
# -----------------------------------------------------------------------------

CLASSIFICATION_CACHE_TABLE = "asset_classification_cache"
CLASSIFICATION_CACHE_TTL_DAYS = 30

# Overrides manuais para casos que a heurística erra ou para garantir categorização
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

# -----------------------------------------------------------------------------
# REGEX PATTERNS (PADRÕES DE TEXTO)
# -----------------------------------------------------------------------------

# Desenvolvimento: Termos ligados a obras, loteamentos e ganho de capital
P_DEV = [
    re.compile(r"\bdesenvolvimento\b"),
    re.compile(r"\bincorporac\w*\b"),   # incorporação
    re.compile(r"\bpermuta\b"),
    re.compile(r"\bloteamento\b"),
    re.compile(r"\bganho\s+de\s+capital\b"),
    re.compile(r"\blandbank\b"),
    re.compile(r"\bconstruc\w*\b"),
    re.compile(r"\bvenda\b"),           # foco em venda vs aluguel
]

# Papel: Crédito, CRI, Recebíveis
P_CRI = [
    re.compile(r"\bcri\b"),
    re.compile(r"\bcr[i|s]\b"),
    re.compile(r"certificad(?:o|os)\s+de\s+recebiveis"),
    re.compile(r"\brecebiveis?\s+imobiliarios?\b"),
    re.compile(r"\btitulos?\s+de\s+credito\b"),
    re.compile(r"\bipca\b"),
    re.compile(r"\bcdi\b"),
    re.compile(r"\bhigh\s+yield\b"),
    re.compile(r"\bhigh\s+grade\b"),
]

# Fundo de Fundos
P_FOF = [
    re.compile(r"\bfundo\s+de\s+fundos\b"),
    re.compile(r"\bfof\b"),
    re.compile(r"\bcotas?\s+de\s+(outros\s+)?fundos?\b"),
    re.compile(r"\bquis\b"),
]

# Híbrido / Multiestratégia
P_MULTI = [
    re.compile(r"\bmultiestrategi\w*\b"),
    re.compile(r"\bmultistrateg\w*\b"),
    re.compile(r"\bdiversificad\w*\b"),
    re.compile(r"\bgestao\s+ativa\b"),
    re.compile(r"\bhibrid\w*\b"),
    re.compile(r"\bmixed\b"),
]

# Tijolo Geral (Renda)
P_TIJOLO_GERAL = [
    re.compile(r"\blogistic\w*\b"),
    re.compile(r"\bgalpa\w*\b"),
    re.compile(r"\barmaz\w*\b"),
    re.compile(r"\bshopping\b"),
    re.compile(r"\bmall\w*\b"),
    re.compile(r"\bvarej\w*\b"),
    re.compile(r"\blajes?\b"),
    re.compile(r"\bescritor\w*\b"),

    # --- ALTERAÇÃO AQUI ---
    re.compile(r"\bcorporativ\w*\b"),
    re.compile(r"\bcorporate\b"),  # Adicionado: Pega "Corporate" (XPCM11, etc)
    re.compile(r"\boffice\b"),

    re.compile(r"\brenda\s+urbana\b"),
    re.compile(r"\bedifici\w*\b"),

    # --- ALTERAÇÃO AQUI ---
    re.compile(r"\bimoveis?\b"),  # Pega "Imóvel"
    re.compile(r"\bimobiliari\w*\b"),  # Adicionado: Pega "Imobiliário" (presente no nome de quase todos)
    re.compile(r"\breal\s+estate\b"),  # Adicionado: Pega descrições em inglês (comum no Yahoo)

    re.compile(r"\bpredio\b"),
    re.compile(r"\bhospital\b"),
    re.compile(r"\beducacional\b"),
]

# Fiagro (caso queira separar ou jogar em papel)
P_FIAGRO = [
    re.compile(r"\bfiagro\b"),
    re.compile(r"\bcra\b"),
    re.compile(r"\bagronegoc\w*\b"),
    re.compile(r"\bfarmland\b"),
    re.compile(r"\bterra\b"),
]

# -----------------------------------------------------------------------------
# HELPER FUNCTIONS
# -----------------------------------------------------------------------------

def _norm(s: str) -> str:
    """Lowercase + remove accents + keep alnum/space only."""
    if not s:
        return ""
    s = str(s).lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def _score(text: str, patterns: List[re.Pattern]) -> int:
    return sum(1 for p in patterns if p.search(text))

def _safe_parse_iso(dt_str: str) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        s = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None

def _looks_like_etf(text: str, quote_type: str) -> bool:
    if quote_type == "etf":
        return True
    if re.search(r"\b(etf|fundo\s+de\s+indice|exchange\s+traded\s+fund)\b", text):
        return True
    return False

def _looks_like_fii(ticker_up: str, text: str, quote_type: str) -> bool:
    if _looks_like_etf(text, quote_type):
        return False
    if re.search(r"\b(fii|fundo\s+de\s+investimento\s+imobiliario|fdo\s+inv\s+imob)\b", text):
        return True
    if "reit" in quote_type:
        return True
    if ticker_up.endswith("11"):
        return True
    return False

def _confidence_from_scores(is_fii: bool, is_etf: bool, quote_type: str, scores: Dict[str, int], matched_override: bool) -> int:
    if matched_override:
        return 99

    base = 35
    if is_fii: base += 20
    if is_etf: base += 20
    if quote_type in ("etf", "equity"): base += 10

    # Soma de scores relevantes
    total_matches = sum(scores.values())
    base += min(20, total_matches * 5)

    return max(5, min(95, base))

# -----------------------------------------------------------------------------
# DATABASE CACHE FUNCTIONS
# -----------------------------------------------------------------------------

def _get_cache(supabase, ticker_up: str) -> Optional[Dict[str, Any]]:
    try:
        resp = supabase.table(CLASSIFICATION_CACHE_TABLE).select("*").eq("ticker", ticker_up).limit(1).execute()
        if not resp.data:
            return None
        row = resp.data[0]

        updated_at = _safe_parse_iso(row.get("updated_at") or row.get("inserted_at") or "")
        if not updated_at:
            return None

        if updated_at < (datetime.now(updated_at.tzinfo) - timedelta(days=CLASSIFICATION_CACHE_TTL_DAYS)):
            return None

        if not row.get("detected_type"):
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

# -----------------------------------------------------------------------------
# SYNC ROUTES (STANDARD IMPLEMENTATION)
# -----------------------------------------------------------------------------

def normalize_yahoo(df: pd.DataFrame, ticker: str) -> List[Dict[str, Any]]:
    """Converte DataFrame do Yahoo para lista de dicts compatível com Supabase."""
    if df.empty:
        return []

    df = df.reset_index()
    records = []
    for _, row in df.iterrows():
        try:
            records.append({
                "ticker": ticker,
                "date": row["Date"].strftime("%Y-%m-%d"),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": int(row["Volume"]) if pd.notnull(row["Volume"]) else 0
            })
        except Exception:
            continue
    return records

@market_data_bp.get("/constants")
def get_market_constants():
    """
    Retorna o contrato de categorias disponíveis para o Frontend montar a UI.
    """
    return ASSET_SCHEMA

@market_data_bp.post("/ticker")
def sync_ticker(payload: TickerSync):
    """
    Sincroniza histórico de preços (OHLCV) via Yahoo Finance.
    """
    ticker = payload.ticker
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker obrigatório")

    yf_ticker = f"{ticker}.SA" if not ticker.endswith(".SA") else ticker
    clean_ticker = ticker.replace(".SA", "").upper()

    print(f"📡 Syncing prices for {yf_ticker}...", flush=True)

    try:
        df = yf.download(yf_ticker, period="5y", interval="1d", progress=False)

        if df.empty:
            raise HTTPException(status_code=404, detail=f"Sem dados no Yahoo para {ticker}")

        data = normalize_yahoo(df, clean_ticker)

        supabase = get_supabase()

        batch_size = 1000
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            supabase.table("market_data_daily").upsert(batch, on_conflict="ticker,date").execute()

        return {"status": "success", "rows_synced": len(data)}

    except Exception as e:
        print(f"❌ Error syncing {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@market_data_bp.post("/ifix")
def sync_ifix():
    try:
        df = yf.download("IFIX.SA", period="1y", interval="1d", progress=False)
        return {"status": "success", "latest": df.index[-1].strftime("%Y-%m-%d")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@market_data_bp.post("/cdi")
def sync_cdi():
    return {"status": "skipped", "message": "Implementar integração BCB/SGS"}

@market_data_bp.post("/ibov")
def sync_ibov():
    try:
        df = yf.download("^BVSP", period="1y", interval="1d", progress=False)
        return {"status": "success", "latest": df.index[-1].strftime("%Y-%m-%d")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# ROTA DE CLASSIFICAÇÃO (LÓGICA PRINCIPAL)
# -----------------------------------------------------------------------------

@market_data_bp.post("/classify")
def classify_ticker(payload: TickerSync):
    """
    Classifica o ativo (FII, ETF ou Ação) com foco nas categorias solicitadas.
    """
    ticker = payload.ticker
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker required")

    ticker_up = ticker.upper().replace(".SA", "")
    yf_ticker = f"{ticker_up}.SA"
    print(f"📡 Classifying {yf_ticker}...", flush=True)

    # Scaffold do resultado base
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

        # 1) CHECK OVERRIDES
        if ticker_up in CLASSIFICATION_OVERRIDES:
            ov = CLASSIFICATION_OVERRIDES[ticker_up]
            base_result.update(ov)
            base_result["confidence"] = _confidence_from_scores(False, False, "unknown", {}, True)
            base_result["source"] = "override"
            _upsert_cache(supabase, base_result)
            return base_result

        # 2) CHECK CACHE
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

        # 3) FETCH YAHOO
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

        # Normalização para análise
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

        scores = {
            "cri": s_cri, "fof": s_fof, "multi": s_multi,
            "dev": s_dev, "tijolo": s_tijolo, "fiagro": s_fiagro
        }

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
                base_result["sector"] = "papel" # ou fiagro
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
                if "logistic" in text: sub = "Logística"
                elif "shopping" in text: sub = "Shopping"
                elif "laje" in text or "office" in text: sub = "Lajes"
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

        # === AÇÕES (COM CORREÇÃO DE ESTRATÉGIA) ===
        if "equity" in qtype_n:
            # 1. Normalização do Setor Yahoo
            sector_n = _norm(sector_y)

            sector_map = {
                "financial services": "Financeiro",
                "basic materials": "Materiais Básicos",
                "utilities": "Utilidade Pública",
                "energy": "Energia",
                "consumer defensive": "Consumo Não-Cíclico",
                "consumer cyclical": "Consumo Cíclico",
                "industrials": "Industrial",
                "technology": "Tecnologia",
                "healthcare": "Saúde",
                "real estate": "Imobiliário",
                "communication services": "Comunicações"
            }

            translated_sector = sector_map.get(sector_n, sector_y.capitalize() if sector_y else "Geral")

            # 2. Definição da Estratégia (Perene vs Cíclica)
            STRATEGY_PERENE = [
                "Financeiro",
                "Utilidade Pública",
                "Energia",
                "Consumo Não-Cíclico",
                "Saúde",
                "Imobiliário"
            ]

            if translated_sector in STRATEGY_PERENE:
                macro_strategy = "Perenes (Renda/Defesa)"
            else:
                macro_strategy = "Cíclicas (Valor/Crescimento)"

            # O campo 'sector' é usado pelo Frontend para agrupar nos sliders
            base_result["sector"] = macro_strategy
            base_result["detected_type"] = f"Ação - {translated_sector}"
            base_result["reasoning"] = f"Setor Yahoo: {sector_y} -> {macro_strategy}"

            base_result["confidence"] = 80
            _upsert_cache(supabase, base_result)
            return base_result

        # Fallback Final
        base_result["sector"] = "outros"
        base_result["reasoning"] = f"Não classificado. Type={quote_type}"
        _upsert_cache(supabase, base_result)
        return base_result

    except Exception as e:
        print(f"❌ Error classifying: {e}")
        return {
            "ticker": ticker_up,
            "detected_type": "Erro",
            "sector": "erro",
            "reasoning": str(e),
            "confidence": 0,
            "source": "error",
            "updated_at": datetime.now().isoformat()
        }