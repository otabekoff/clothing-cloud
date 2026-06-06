"""Idempotent seed data so the app has something to show on first boot.

Seeds three demo user accounts (one per role), a product catalogue, warehouse
stock and a spread of customers/orders across several days (so the dashboard
trend chart has shape).
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from . import models
from .security import hash_password

# Demo credentials — documented in the README. Change before any real use.
DEMO_USERS = [
    ("admin@nimbus.dev", "Ada Admin", "admin", "admin123"),
    ("manager@nimbus.dev", "Max Manager", "manager", "manager123"),
    ("viewer@nimbus.dev", "Vera Viewer", "viewer", "viewer123"),
]


def seed_users(db: Session) -> None:
    if db.query(models.User).first():
        return
    db.add_all(
        models.User(
            email=email,
            full_name=name,
            role=role,
            hashed_password=hash_password(password),
        )
        for email, name, role, password in DEMO_USERS
    )
    db.commit()


def seed_business(db: Session) -> None:
    if db.query(models.Product).first():
        return  # already seeded

    products = [
        models.Product(sku="TS-CW-001", name="Crew Neck T-Shirt", category="Tops", unit_price=4.50),
        models.Product(
            sku="DN-SL-014", name="Slim Fit Denim", category="Bottoms", unit_price=12.90
        ),
        models.Product(sku="HD-ZP-220", name="Zip Hoodie", category="Outerwear", unit_price=15.75),
        models.Product(sku="PL-CT-330", name="Cotton Polo", category="Tops", unit_price=7.20),
        models.Product(
            sku="JK-BM-440", name="Bomber Jacket", category="Outerwear", unit_price=22.40
        ),
        models.Product(
            sku="CH-RG-550", name="Relaxed Chinos", category="Bottoms", unit_price=14.30
        ),
        models.Product(sku="SK-AL-660", name="A-Line Skirt", category="Bottoms", unit_price=9.80),
        models.Product(sku="SW-KN-770", name="Knit Sweater", category="Tops", unit_price=18.60),
        models.Product(sku="SC-WL-880", name="Wool Scarf", category="Accessories", unit_price=6.40),
        models.Product(
            sku="CP-BB-990", name="Baseball Cap", category="Accessories", unit_price=5.10
        ),
    ]
    db.add_all(products)
    db.flush()

    warehouses = ["Tashkent-Central", "Samarkand-RDC", "Almaty-Hub"]
    for pi, p in enumerate(products):
        for wi, wh in enumerate(warehouses):
            qty = max(20, 600 - pi * 45 - wi * 90)
            db.add(models.StockItem(product_id=p.id, warehouse=wh, quantity=qty))

    customers = [
        models.Customer(
            name="Silk Road Retail", region="Tashkent", email="orders@silkroad.example"
        ),
        models.Customer(name="Fergana Fashions", region="Fergana", email="buy@fergana.example"),
        models.Customer(name="Steppe Apparel Co", region="Almaty", email="po@steppe.example"),
        models.Customer(name="Caspian Clothing", region="Aktau", email="sales@caspian.example"),
        models.Customer(
            name="Bukhara Bazaar Ltd", region="Bukhara", email="orders@bukhara.example"
        ),
    ]
    db.add_all(customers)
    db.flush()

    now = datetime.now(UTC)
    statuses = ["shipped", "processing", "pending", "shipped", "cancelled"]
    totals = [
        1340.00,
        890.50,
        2210.75,
        560.20,
        1780.00,
        430.90,
        990.00,
        3120.40,
        275.60,
        1450.25,
        680.00,
        2050.80,
    ]
    for i, total in enumerate(totals):
        db.add(
            models.Order(
                customer_id=customers[i % len(customers)].id,
                status=statuses[i % len(statuses)],
                total=total,
                created_at=now - timedelta(days=(len(totals) - i) // 2),
            )
        )
    db.commit()


def seed(db: Session) -> None:
    seed_users(db)
    seed_business(db)
