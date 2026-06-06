"""Dashboard analytics: pre-aggregated figures for the homepage charts.

Doing the aggregation in SQL (GROUP BY) keeps the payload small and pushes the
work to the database — the right place for it in a cloud topology.
"""

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(get_current_user)],
)

LOW_STOCK_THRESHOLD = 150


@router.get("", response_model=schemas.DashboardData)
def dashboard(db: Session = Depends(get_db)):
    products = db.query(models.Product).all()
    stock_items = db.query(models.StockItem).options(joinedload(models.StockItem.product)).all()
    customers_count = db.query(func.count(models.Customer.id)).scalar() or 0
    orders = db.query(models.Order).all()

    total_stock = sum(s.quantity for s in stock_items)
    revenue = sum(o.total for o in orders)
    low_stock = sum(1 for s in stock_items if s.quantity < LOW_STOCK_THRESHOLD)

    # Revenue grouped by order status
    rev_by_status: dict[str, float] = defaultdict(float)
    for o in orders:
        rev_by_status[o.status] += o.total

    # Stock grouped by warehouse
    stock_by_wh: dict[str, int] = defaultdict(int)
    for s in stock_items:
        stock_by_wh[s.warehouse] += s.quantity

    # Product count grouped by category
    by_category: dict[str, int] = defaultdict(int)
    for p in products:
        by_category[p.category] += 1

    # Orders revenue grouped by day (chronological)
    trend: dict[str, float] = defaultdict(float)
    for o in orders:
        day = o.created_at.strftime("%Y-%m-%d") if o.created_at else "—"
        trend[day] += o.total

    return schemas.DashboardData(
        kpis=schemas.KpiSummary(
            products=len(products),
            total_stock=total_stock,
            customers=customers_count,
            orders=len(orders),
            revenue=round(revenue, 2),
            low_stock_items=low_stock,
        ),
        revenue_by_status=[
            schemas.NamedValue(name=k, value=round(v, 2)) for k, v in rev_by_status.items()
        ],
        stock_by_warehouse=[schemas.NamedValue(name=k, value=v) for k, v in stock_by_wh.items()],
        products_by_category=[schemas.NamedValue(name=k, value=v) for k, v in by_category.items()],
        orders_trend=[
            schemas.NamedValue(name=k, value=round(v, 2)) for k, v in sorted(trend.items())
        ],
    )
