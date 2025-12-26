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
from backend.source.features.market_data.market_data_schemas import TickerSync

market_data_bp = APIRouter(prefix="/sync", tags=["Market Data"])

# ... (MANTENHA AS FUNÇÕES DE SYNC: normalize_yahoo, sync_ticker, sync_ifix, sync_cdi, sync_ibov IGUAIS) ...
# Vou replicar apenas da parte de CLASSIFICATION para baixo onde ocorreram as mudanças.

# -----------------------------------------------------------------------------
# Classification: robust scoring + regex + caching
# -----------------------------------------------------------------------------

# Cache configuration
CLASSIFICATION_CACHE_TABLE = "asset_classification_cache"
CLASSIFICATION_CACHE_TTL_DAYS = 30

# UPDATED: Overrides now include explicitly defined 'sector'
CLASSIFICATION_OVERRIDES: Dict[str, Dict[str, str]] = {
    "KNCR11": {
        "detected_type": "FII - Papel (CRI / Recebíveis)",
        "sector": "Real Estate",
        "reasoning": "Override: fundo conhecido de CRI/recebíveis."
    },
    "KNHF11": {
        "detected_type": "FII - Híbrido / Multiestratégia",
        "sector": "Real Estate",
        "reasoning": "Override: fundo conhecido multiestratégia/híbrido."
    },
    "BTLG11": {
        "detected_type": "FII - Tijolo (Logística)",
        "sector": "Real Estate",
        "reasoning": "Override: fundo conhecido do segmento logística."
    },
    "XPCM11": {
        "detected_type": "FII - Tijolo (Lajes Corporativas)",
        "sector": "Real Estate",
        "reasoning": "Override: fundo conhecido do segmento lajes corporativas."
    },
    "IVVB11": {
        "detected_type": "ETF - Internacional (EUA - S&P 500)",
        "sector": "ETF",
        "reasoning": "Override: ETF conhecido S&P 500."
    },
    "QQQQ11": {
        "detected_type": "ETF - Internacional (EUA - Nasdaq-100 High Beta)",
        "sector": "ETF",
        "reasoning": "Override: ETF conhecido Nasdaq-100 High Beta."
    },
}


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
        # Supabase can return "Z"
        s = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _looks_like_etf(text: str, quote_type: str) -> bool:
    if quote_type == "etf":
        return True
    # Common ETF descriptors
    if re.search(r"\b(etf|fundo\s+de\s+indice|exchange\s+traded\s+fund)\b", text):
        return True
    return False


def _looks_like_fii(ticker_up: str, text: str, quote_type: str) -> bool:
    # If it clearly looks like ETF, do NOT call it FII
    if _looks_like_etf(text, quote_type):
        return False

    # Strong textual markers
    if re.search(r"\b(fii|fundo\s+de\s+investimento\s+imobiliario|fdo\s+inv\s+imob)\b", text):
        return True

    # REIT sometimes appears
    if "reit" in quote_type:
        return True

    # Heuristic fallback: ticker ending with 11 often FII/ETF; we already excluded ETF above
    if ticker_up.endswith("11"):
        return True

    return False


# FII patterns
P_CRI = [
    re.compile(r"\bcri\b"),
    re.compile(r"\bcr[i|s]\b"),  # minimal noise coverage
    re.compile(r"certificad(?:o|os)\s+de\s+recebiveis"),
    re.compile(r"\brecebiveis?\s+imobiliarios?\b"),
    re.compile(r"\btitulos?\s+de\s+credito\b"),
]
P_FOF = [
    re.compile(r"\bfundo\s+de\s+fundos\b"),
    re.compile(r"\bfof\b"),
    re.compile(r"\bcotas?\s+de\s+(outros\s+)?fundos?\b"),
]
P_MULTI = [
    re.compile(r"\bmultiestrategi\w*\b"),
    re.compile(r"\bmultistrateg\w*\b"),
    re.compile(r"\bdiversificad\w*\b"),
    re.compile(r"\bgestao\s+ativa\b"),
]
P_LOG = [
    re.compile(r"\blogistic\w*\b"),
    re.compile(r"\bgalpa\w*\b"),
    re.compile(r"\barmaz\w*\b"),
    re.compile(r"\bwarehouse\b"),
    re.compile(r"\bdistribution\s+center\b"),
]
P_SHOP = [
    re.compile(r"\bshopping\b"),
    re.compile(r"\bmall\w*\b"),
    re.compile(r"\bvarej\w*\b"),
    re.compile(r"\bretail\b"),
]
P_OFFICE = [
    re.compile(r"\blajes?\b"),
    re.compile(r"\bescritor\w*\b"),
    re.compile(r"\bcorporativ\w*\b"),
    re.compile(r"\boffice\b"),
    re.compile(r"\bcorporate\b"),
]
P_FIAGRO = [
    re.compile(r"\bfiagro\b"),
    re.compile(r"\bcra\b"),
    re.compile(r"\bagronegoc\w*\b"),
    re.compile(r"\bfarmland\b"),
]


def _confidence_from_scores(is_fii: bool, is_etf: bool, quote_type: str, scores: Dict[str, int],
                            matched_override: bool) -> int:
    if matched_override:
        return 95

    base = 35
    if is_fii:
        base += 20
    if is_etf:
        base += 20
    if quote_type in ("etf", "equity"):
        base += 10

    # Add points for strong, unique signals
    base += min(20, scores.get("cri", 0) * 10)
    base += min(15, scores.get("fof", 0) * 8)
    base += min(15, scores.get("multi", 0) * 7)
    base += min(15, scores.get("tijolo", 0) * 6)

    return max(5, min(99, base))


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

        # Must have detected_type to be useful
        if not row.get("detected_type"):
            return None

        return row
    except Exception:
        return None


def _upsert_cache(supabase, row: Dict[str, Any]) -> None:
    try:
        # Expected table fields (recommended):
        # ticker (pk), detected_type, reasoning, sector, quote_type, confidence, raw_info_sample, updated_at
        row["updated_at"] = datetime.now().isoformat()
        supabase.table(CLASSIFICATION_CACHE_TABLE).upsert(row, on_conflict="ticker").execute()
    except Exception as e:
        # Cache failure should never kill the endpoint
        print(f"⚠️ Cache upsert failed: {e}")


@market_data_bp.post("/classify")
def classify_ticker(payload: TickerSync):
    """
    Classify an asset (FII, ETF or Stock) using:
    - normalization + regex patterns + scoring
    - cache (Supabase)
    - hard overrides
    """
    ticker = payload.ticker
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    ticker_up = ticker.upper().replace(".SA", "")
    yf_ticker = f"{ticker_up}.SA"
    print(f"📡 Classifying {yf_ticker}...", flush=True)

    # Base result scaffold
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

        # 0) Overrides first (fast and stable)
        if ticker_up in CLASSIFICATION_OVERRIDES:
            ov = CLASSIFICATION_OVERRIDES[ticker_up]
            base_result["detected_type"] = ov["detected_type"]
            base_result["reasoning"] = ov["reasoning"]
            # Force sector from override if present, else keep default
            base_result["sector"] = ov.get("sector", base_result["sector"])
            base_result["confidence"] = _confidence_from_scores(False, False, "unknown", {}, matched_override=True)
            base_result["source"] = "override"
            _upsert_cache(supabase, base_result)
            return base_result

        # 1) Cache
        cached = _get_cache(supabase, ticker_up)
        if cached:
            return {
                "ticker": cached.get("ticker", ticker_up),
                "detected_type": cached.get("detected_type", "Indefinido"),
                "reasoning": cached.get("reasoning", "cache"),
                "sector": cached.get("sector", "Outros"),
                "quote_type": cached.get("quote_type", "unknown"),
                "confidence": cached.get("confidence", 50),
                "raw_info_sample": cached.get("raw_info_sample", "Sem descrição"),
                "source": cached.get("source", "cache"),
                "updated_at": cached.get("updated_at"),
            }

        # 2) Yahoo fetch
        asset = yf.Ticker(yf_ticker)
        info = asset.info or {}

        summary = str(info.get("longBusinessSummary") or "")
        short_name = str(info.get("shortName") or "")
        long_name = str(info.get("longName") or "")
        sector = str(info.get("sector") or "")
        quote_type = str(info.get("quoteType") or "")
        category = str(info.get("category") or "")

        base_result["sector"] = sector or "Outros"
        base_result["quote_type"] = quote_type or "unknown"
        base_result["raw_info_sample"] = (summary[:100] + "...") if summary else "Sem descrição"

        # Normalize text
        text = _norm(f"{summary} {short_name} {long_name} {category}")
        qtype_n = _norm(quote_type)
        sector_n = _norm(sector)

        # 3) Determine broad type
        looks_etf = _looks_like_etf(text, qtype_n)
        # Check FII first (Brazil specific)
        looks_fii = _looks_like_fii(ticker_up, text, qtype_n)

        # Scores for FIIs
        s_cri = _score(text, P_CRI)
        s_fof = _score(text, P_FOF)
        s_multi = _score(text, P_MULTI)
        s_log = _score(text, P_LOG)
        s_shop = _score(text, P_SHOP)
        s_off = _score(text, P_OFFICE)
        s_fiagro = _score(text, P_FIAGRO)

        scores = {
            "cri": s_cri,
            "fof": s_fof,
            "multi": s_multi,
            "tijolo": (s_log + s_shop + s_off),
            "fiagro": s_fiagro,
        }

        # 4) Classification logic

        # === FII LOGIC ===
        if looks_fii:
            # FIX: Force sector to 'Real Estate' instead of whatever Yahoo sent
            base_result["sector"] = "Real Estate"

            if s_fiagro >= 1:
                base_result["detected_type"] = "FII - Fiagro"
                base_result["reasoning"] = f"FII com sinais de Fiagro (score_fiagro={s_fiagro})."
            else:
                mixed_groups = 0
                mixed_groups += 1 if s_cri > 0 else 0
                mixed_groups += 1 if s_fof > 0 else 0
                mixed_groups += 1 if (s_log + s_shop + s_off) > 0 else 0
                mixed_groups += 1 if s_multi > 0 else 0

                if s_cri >= 1 and (s_log + s_shop + s_off) == 0 and s_fof == 0 and s_multi == 0:
                    base_result["detected_type"] = "FII - Papel (CRI / Recebíveis)"
                    base_result["reasoning"] = f"FII com sinais fortes de CRI/recebíveis (score_cri={s_cri})."
                elif mixed_groups >= 2:
                    base_result["detected_type"] = "FII - Híbrido / Multiestratégia"
                    base_result["reasoning"] = (
                        "FII com sinais mistos ("
                        f"cri={s_cri}, fof={s_fof}, tijolo={s_log + s_shop + s_off}, multi={s_multi})."
                    )
                else:
                    if s_log >= 1:
                        base_result["detected_type"] = "FII - Tijolo (Logística)"
                    elif s_shop >= 1:
                        base_result["detected_type"] = "FII - Tijolo (Shopping)"
                    elif s_off >= 1:
                        base_result["detected_type"] = "FII - Tijolo (Lajes Corporativas)"
                    elif s_cri >= 1:
                        base_result["detected_type"] = "FII - Papel (CRI / Recebíveis)"
                    elif s_fof >= 1:
                        base_result["detected_type"] = "FII - Fundo de Fundos (FoF)"
                    else:
                        base_result["detected_type"] = "FII - Indefinido (sem sinais suficientes)"

                    base_result["reasoning"] = (
                        "FII detectado por heurística. "
                        f"Scores: cri={s_cri}, log={s_log}, shop={s_shop}, office={s_off}, fof={s_fof}, multi={s_multi}."
                    )

            base_result["confidence"] = _confidence_from_scores(True, False, qtype_n, scores, matched_override=False)
            base_result["source"] = "heuristic+yahoo"
            _upsert_cache(supabase, base_result)
            return base_result

        # === ETF LOGIC ===
        if looks_etf:
            # FIX: Force sector to 'ETF' (or broad variants)
            # Default to ETF, can be refined below if 'Internacional' logic exists
            base_result["sector"] = "ETF"

            if ("sp 500" in text) or ("s p 500" in text) or ("s&p 500" in text) or (ticker_up.lower() == "ivvb11"):
                base_result["detected_type"] = "ETF - Internacional (EUA - S&P 500)"
                base_result["reasoning"] = "Identificado como ETF ligado ao S&P 500."
            elif ("nasdaq" in text) or (ticker_up.lower() in ("qqqq11", "qbtc11")):
                if ticker_up.lower() == "qqqq11" or "high beta" in text:
                    base_result["detected_type"] = "ETF - Internacional (EUA - Nasdaq-100 High Beta)"
                else:
                    base_result["detected_type"] = "ETF - Internacional (EUA - Nasdaq)"
                base_result["reasoning"] = "Identificado como ETF ligado ao Nasdaq."
            elif ("ibovespa" in text) or ("ibov" in text) or ("bova" in text):
                base_result["detected_type"] = "ETF - Brasil (Ibovespa)"
                base_result["reasoning"] = "Identificado como ETF ligado ao Ibovespa."
            elif ("small" in text) or ("smal" in text):
                base_result["detected_type"] = "ETF - Brasil (Small Caps)"
                base_result["reasoning"] = "Identificado como ETF de small caps."
            elif ("crypto" in text) or ("bitcoin" in text) or ("hash" in text):
                base_result["detected_type"] = "ETF - Cripto"
                base_result["reasoning"] = "Identificado como ETF cripto."
            elif ("fixed income" in text) or ("renda fixa" in text):
                base_result["detected_type"] = "ETF - Renda Fixa"
                base_result["reasoning"] = "Identificado como ETF de renda fixa."
            else:
                base_result["detected_type"] = "ETF - Outros"
                base_result[
                    "reasoning"] = "Identificado como ETF, mas não foi possível inferir o índice/região com precisão."

            base_result["confidence"] = _confidence_from_scores(False, True, qtype_n, scores, matched_override=False)
            base_result["source"] = "heuristic+yahoo"
            _upsert_cache(supabase, base_result)
            return base_result

        # === STOCKS (AÇÕES) ===
        if qtype_n == "equity" or ("equity" in qtype_n):
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
            }
            mapped_sector = sector_map.get(sector_n, (sector.capitalize() if sector else "Geral"))

            # Stock sector is valid, but we translate it
            base_result["sector"] = mapped_sector
            base_result["detected_type"] = f"Ação - {mapped_sector}"
            base_result["reasoning"] = f"Identificado como Ação. Setor Original: {sector or 'desconhecido'}"
            base_result["confidence"] = _confidence_from_scores(False, False, qtype_n, scores, matched_override=False)
            base_result["source"] = "heuristic+yahoo"
            _upsert_cache(supabase, base_result)
            return base_result

        # Fallback
        base_result["reasoning"] = f"Não classificado com segurança. quoteType='{quote_type}', sector='{sector}'."
        base_result["confidence"] = 15
        base_result["source"] = "heuristic+yahoo"
        _upsert_cache(supabase, base_result)
        return base_result

    except Exception as e:
        print(f"❌ Error classifying: {e}")
        return {
            "ticker": ticker_up,
            "detected_type": "Indefinido",
            "reasoning": f"Erro na classificação: {str(e)}",
            "sector": "Desconhecido",
            "quote_type": "unknown",
            "confidence": 0,
            "raw_info_sample": "Sem descrição",
            "source": "error",
            "updated_at": datetime.now().isoformat(),
        }