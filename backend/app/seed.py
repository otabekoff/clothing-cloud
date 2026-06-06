"""Idempotent seed data so the dashboard has something to show on first boot."""

from sqlalchemy.orm import Session

from . import models


def seed(db: Session) -> None:
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
    ]
    db.add_all(products)
    db.flush()

    warehouses = ["Tashkent-Central", "Samarkand-RDC", "Almaty-Hub"]
    for p in products:
        for i, wh in enumerate(warehouses):
            db.add(models.StockItem(product_id=p.id, warehouse=wh, quantity=500 - i * 120))

    customers = [
        models.Customer(
            name="Silk Road Retail", region="Tashkent", email="orders@silkroad.example"
        ),
        models.Customer(name="Fergana Fashions", region="Fergana", email="buy@fergana.example"),
        models.Customer(name="Steppe Apparel Co", region="Almaty", email="po@steppe.example"),
    ]
    db.add_all(customers)
    db.flush()

    db.add_all(
        [
            models.Order(customer_id=customers[0].id, status="shipped", total=1340.00),
            models.Order(customer_id=customers[1].id, status="processing", total=890.50),
            models.Order(customer_id=customers[2].id, status="pending", total=2210.75),
        ]
    )
    db.commit()
