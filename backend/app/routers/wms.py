"""WMS: warehouse stock levels per location (full CRUD).

Reads are open to any authenticated user; writes require `manager`+.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user, require_role

router = APIRouter(
    prefix="/api/wms",
    tags=["WMS"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/stock", response_model=list[schemas.StockOut])
def list_stock(db: Session = Depends(get_db)):
    return (
        db.query(models.StockItem)
        .options(joinedload(models.StockItem.product))
        .order_by(models.StockItem.warehouse)
        .all()
    )


@router.post(
    "/stock",
    response_model=schemas.StockOut,
    status_code=201,
    dependencies=[Depends(require_role("manager"))],
)
def create_stock(payload: schemas.StockCreate, db: Session = Depends(get_db)):
    if not db.get(models.Product, payload.product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    item = models.StockItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch(
    "/stock/{item_id}",
    response_model=schemas.StockOut,
    dependencies=[Depends(require_role("manager"))],
)
def update_stock(item_id: int, payload: schemas.StockUpdate, db: Session = Depends(get_db)):
    item = db.get(models.StockItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/stock/{item_id}",
    status_code=204,
    dependencies=[Depends(require_role("manager"))],
)
def delete_stock(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.StockItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    db.delete(item)
    db.commit()
