from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.source.core.database import get_db
from backend.source.models.sql_models import AssetPurchase
from backend.source.features.wallet.wallet_schema import ImportPurchasesRequest

wallet_bp = APIRouter(prefix="/wallet", tags=["Wallet"])

@wallet_bp.post("/import")
def import_purchases(payload: ImportPurchasesRequest, db: Session = Depends(get_db)):
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