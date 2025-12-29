from typing import List

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from backend.source.core.database import get_db
from backend.source.models.sql_models import AssetPurchase
from backend.source.features.wallet.wallet_schema import (
    ImportPurchasesRequest,
    AssetPurchaseResponse,
    AssetPurchaseInput
)

wallet_bp = APIRouter(prefix="/wallet", tags=["Wallet"])


# --- ROTA DE IMPORTAÇÃO (Mantém igual) ---
@wallet_bp.post("/import")
def import_purchases(payload: ImportPurchasesRequest, db: Session = Depends(get_db)):
    # ... (código da importação mantém igual) ...
    try:
        new_records = []
        for item in payload.purchases:
            record = AssetPurchase(
                user_id=payload.user_id,
                ticker=item.ticker.upper(),
                name=item.name,
                type=item.type.lower(),
                qty=item.qty,
                price=item.price,
                trade_date=item.trade_date
            )
            new_records.append(record)

        if new_records:
            db.add_all(new_records)
            db.commit()

        return {"success": True, "count": len(new_records), "message": "Import successful"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# --- CRUD DO APORTE MANUAL (CORRIGIDO AQUI) ---

# 1. GET /purchases (Listar)
@wallet_bp.get("/purchases", response_model=List[AssetPurchaseResponse])
def get_user_purchases(user_id: str, db: Session = Depends(get_db)):
    """Fetch all asset purchases for a specific user."""
    purchases = db.query(AssetPurchase).filter(AssetPurchase.user_id == user_id).all()
    return purchases


# 2. POST /purchases (Criar) - ANTES ERA apenas "/"
@wallet_bp.post("/purchases", response_model=AssetPurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: AssetPurchaseInput, db: Session = Depends(get_db)):
    """Cria um único aporte manual."""
    try:
        new_purchase = AssetPurchase(
            user_id=payload.user_id,
            ticker=payload.ticker.upper(),
            name=payload.name or payload.ticker.upper(),
            type=payload.type.lower(),
            qty=payload.qty,
            price=payload.price,
            trade_date=payload.trade_date
        )
        db.add(new_purchase)
        db.commit()
        db.refresh(new_purchase)
        return new_purchase
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# 3. PUT /purchases/{id} (Editar) - ANTES ERA apenas "/{id}"
@wallet_bp.put("/purchases/{purchase_id}", response_model=AssetPurchaseResponse)
def update_purchase(purchase_id: int, payload: AssetPurchaseInput, db: Session = Depends(get_db)):
    """Edita um aporte existente."""
    purchase = db.query(AssetPurchase).filter(AssetPurchase.id == purchase_id).first()

    if not purchase:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")

    if purchase.user_id != payload.user_id:
        raise HTTPException(status_code=403, detail="Não autorizado")

    try:
        purchase.ticker = payload.ticker.upper()
        purchase.name = payload.name or payload.ticker.upper()
        purchase.type = payload.type.lower()
        purchase.qty = payload.qty
        purchase.price = payload.price
        purchase.trade_date = payload.trade_date

        db.commit()
        db.refresh(purchase)
        return purchase
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# 4. DELETE /purchases/{id} (Deletar) - ANTES ERA apenas "/{id}"
@wallet_bp.delete("/purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase(purchase_id: int, db: Session = Depends(get_db)):
    """Remove um aporte permanentemente."""
    purchase = db.query(AssetPurchase).filter(AssetPurchase.id == purchase_id).first()

    if not purchase:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")

    try:
        db.delete(purchase)
        db.commit()
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))