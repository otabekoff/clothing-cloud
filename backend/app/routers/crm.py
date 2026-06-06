"""CRM: customers and their wholesale orders (full CRUD).

Reads are open to any authenticated user; writes require `manager`+.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user, require_role

router = APIRouter(
    prefix="/api/crm",
    tags=["CRM"],
    dependencies=[Depends(get_current_user)],
)


# ── Customers ────────────────────────────────────────────────────
@router.get("/customers", response_model=list[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).order_by(models.Customer.name).all()


@router.post(
    "/customers",
    response_model=schemas.CustomerOut,
    status_code=201,
    dependencies=[Depends(require_role("manager"))],
)
def create_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    customer = models.Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.patch(
    "/customers/{customer_id}",
    response_model=schemas.CustomerOut,
    dependencies=[Depends(require_role("manager"))],
)
def update_customer(
    customer_id: int, payload: schemas.CustomerUpdate, db: Session = Depends(get_db)
):
    customer = db.get(models.Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete(
    "/customers/{customer_id}",
    status_code=204,
    dependencies=[Depends(require_role("manager"))],
)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.get(models.Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()


# ── Orders ───────────────────────────────────────────────────────
@router.get("/orders", response_model=list[schemas.OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return db.query(models.Order).order_by(models.Order.created_at.desc()).all()


@router.post(
    "/orders",
    response_model=schemas.OrderOut,
    status_code=201,
    dependencies=[Depends(require_role("manager"))],
)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    if not db.get(models.Customer, payload.customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")
    order = models.Order(
        customer_id=payload.customer_id, total=payload.total, status=payload.status
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.patch(
    "/orders/{order_id}",
    response_model=schemas.OrderOut,
    dependencies=[Depends(require_role("manager"))],
)
def update_order(order_id: int, payload: schemas.OrderUpdate, db: Session = Depends(get_db)):
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order


@router.delete(
    "/orders/{order_id}",
    status_code=204,
    dependencies=[Depends(require_role("manager"))],
)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
