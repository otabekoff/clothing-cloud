"""ERP: product master data (full CRUD).

Reads are open to any authenticated user; writes require `manager`+.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user, require_role

router = APIRouter(
    prefix="/api/erp",
    tags=["ERP"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/products", response_model=list[schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(models.Product).order_by(models.Product.sku).all()


@router.post(
    "/products",
    response_model=schemas.ProductOut,
    status_code=201,
    dependencies=[Depends(require_role("manager"))],
)
def create_product(payload: schemas.ProductCreate, db: Session = Depends(get_db)):
    if db.query(models.Product).filter(models.Product.sku == payload.sku).first():
        raise HTTPException(status_code=409, detail="SKU already exists")
    product = models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch(
    "/products/{product_id}",
    response_model=schemas.ProductOut,
    dependencies=[Depends(require_role("manager"))],
)
def update_product(product_id: int, payload: schemas.ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete(
    "/products/{product_id}",
    status_code=204,
    dependencies=[Depends(require_role("manager"))],
)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
