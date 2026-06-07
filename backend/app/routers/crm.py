"""CRM: customers and their wholesale orders (full CRUD).

Reads are open to any authenticated user; writes require `manager`+.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

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
def _build_items(db: Session, items_in: list[schemas.OrderItemIn]) -> list[models.OrderItem]:
    """Resolve line items against products, defaulting unit price to the product's."""
    built: list[models.OrderItem] = []
    for line in items_in:
        product = db.get(models.Product, line.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {line.product_id} not found")
        price = line.unit_price if line.unit_price is not None else product.unit_price
        built.append(
            models.OrderItem(product_id=product.id, quantity=line.quantity, unit_price=price)
        )
    return built


def _orders_query(db: Session):
    return db.query(models.Order).options(
        joinedload(models.Order.items).joinedload(models.OrderItem.product)
    )


@router.get("/orders", response_model=list[schemas.OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return _orders_query(db).order_by(models.Order.created_at.desc()).all()


@router.get("/orders/{order_id}", response_model=schemas.OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = _orders_query(db).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post(
    "/orders",
    response_model=schemas.OrderOut,
    status_code=201,
    dependencies=[Depends(require_role("manager"))],
)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    if not db.get(models.Customer, payload.customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")
    items = _build_items(db, payload.items)
    # If line items are supplied the total is computed from them; otherwise fall
    # back to the explicit total (kept for the simple API contract).
    total = sum(i.quantity * i.unit_price for i in items) if items else (payload.total or 0.0)
    order = models.Order(
        customer_id=payload.customer_id,
        status=payload.status,
        notes=payload.notes,
        total=round(total, 2),
        items=items,
    )
    db.add(order)
    db.commit()
    return get_order(order.id, db)


@router.patch(
    "/orders/{order_id}",
    response_model=schemas.OrderOut,
    dependencies=[Depends(require_role("manager"))],
)
def update_order(order_id: int, payload: schemas.OrderUpdate, db: Session = Depends(get_db)):
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    data = payload.model_dump(exclude_unset=True)
    if "items" in data:
        # Replace the line items wholesale and recompute the total.
        items = _build_items(db, payload.items or [])
        order.items = items
        order.total = round(sum(i.quantity * i.unit_price for i in items), 2)
        data.pop("items", None)
        data.pop("total", None)  # computed, ignore any client total
    for field, value in data.items():
        setattr(order, field, value)
    db.commit()
    return get_order(order.id, db)


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
