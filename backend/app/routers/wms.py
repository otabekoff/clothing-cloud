"""WMS: warehouse stock levels per location."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/wms", tags=["WMS"])


@router.get("/stock", response_model=list[schemas.StockOut])
def list_stock(db: Session = Depends(get_db)):
    return (
        db.query(models.StockItem)
        .options(joinedload(models.StockItem.product))
        .order_by(models.StockItem.warehouse)
        .all()
    )
