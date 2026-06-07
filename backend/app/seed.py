"""Idempotent seed data so the app has something to show on first boot.

Seeds three demo user accounts (one per role), a rich product catalogue,
warehouse stock and a spread of customers/orders (with line items) across
several days so the dashboard charts have shape.
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

# (sku, name, category, unit_price, cost_price, supplier, reorder_level, description)
PRODUCTS = [
    (
        "TS-CW-001",
        "Crew Neck T-Shirt",
        "Tops",
        4.50,
        2.10,
        "Tashkent Textiles",
        200,
        "Soft combed-cotton crew neck, a wholesale staple.",
    ),
    (
        "DN-SL-014",
        "Slim Fit Denim",
        "Bottoms",
        12.90,
        7.40,
        "Fergana Mills",
        150,
        "Stretch slim-fit jeans in mid-wash indigo.",
    ),
    (
        "HD-ZP-220",
        "Zip Hoodie",
        "Outerwear",
        15.75,
        9.20,
        "Almaty Knitwear",
        120,
        "Brushed-fleece full-zip hoodie with kangaroo pockets.",
    ),
    (
        "PL-CT-330",
        "Cotton Polo",
        "Tops",
        7.20,
        3.60,
        "Tashkent Textiles",
        180,
        "Pique-knit polo with ribbed collar.",
    ),
    (
        "JK-BM-440",
        "Bomber Jacket",
        "Outerwear",
        22.40,
        13.10,
        "Almaty Knitwear",
        80,
        "Lightweight bomber with ribbed trims.",
    ),
    (
        "CH-RG-550",
        "Relaxed Chinos",
        "Bottoms",
        14.30,
        8.00,
        "Fergana Mills",
        130,
        "Relaxed-fit cotton chinos.",
    ),
    (
        "SK-AL-660",
        "A-Line Skirt",
        "Bottoms",
        9.80,
        5.10,
        "Samarkand Apparel",
        110,
        "Knee-length A-line skirt.",
    ),
    (
        "SW-KN-770",
        "Knit Sweater",
        "Tops",
        18.60,
        10.90,
        "Almaty Knitwear",
        90,
        "Chunky-knit crew sweater.",
    ),
    (
        "SC-WL-880",
        "Wool Scarf",
        "Accessories",
        6.40,
        2.80,
        "Bukhara Wool Co",
        160,
        "Soft lambswool scarf.",
    ),
    (
        "CP-BB-990",
        "Baseball Cap",
        "Accessories",
        5.10,
        2.20,
        "Tashkent Textiles",
        220,
        "Six-panel cotton twill cap with adjustable strap.",
    ),
]

# (name, region, email, phone, contact, address, status)
CUSTOMERS = [
    (
        "Silk Road Retail",
        "Tashkent",
        "orders@silkroad.example",
        "+998 71 200 1010",
        "Dilnoza Karimova",
        "12 Amir Temur Ave, Tashkent",
        "active",
    ),
    (
        "Fergana Fashions",
        "Fergana",
        "buy@fergana.example",
        "+998 73 244 5050",
        "Otabek Yusupov",
        "5 Mustaqillik St, Fergana",
        "active",
    ),
    (
        "Steppe Apparel Co",
        "Almaty",
        "po@steppe.example",
        "+7 727 311 7788",
        "Aigerim Nsurlan",
        "88 Abay Ave, Almaty",
        "active",
    ),
    (
        "Caspian Clothing",
        "Aktau",
        "sales@caspian.example",
        "+7 729 244 3322",
        "Timur Beket",
        "3rd Microdistrict, Aktau",
        "prospect",
    ),
    (
        "Bukhara Bazaar Ltd",
        "Bukhara",
        "orders@bukhara.example",
        "+998 65 223 9090",
        "Gulnora Saidova",
        "Lyabi-Hauz Sq, Bukhara",
        "inactive",
    ),
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
        models.Product(
            sku=sku,
            name=name,
            category=cat,
            unit_price=price,
            cost_price=cost,
            supplier=supplier,
            reorder_level=reorder,
            description=desc,
        )
        for sku, name, cat, price, cost, supplier, reorder, desc in PRODUCTS
    ]
    db.add_all(products)
    db.flush()

    warehouses = ["Tashkent-Central", "Samarkand-RDC", "Almaty-Hub"]
    for pi, p in enumerate(products):
        for wi, wh in enumerate(warehouses):
            qty = max(20, 600 - pi * 45 - wi * 90)
            db.add(
                models.StockItem(
                    product_id=p.id,
                    warehouse=wh,
                    bin_location=f"{chr(65 + wi)}-{pi + 1:02d}",
                    quantity=qty,
                    reorder_level=150,
                )
            )

    customers = [
        models.Customer(
            name=name,
            region=region,
            email=email,
            phone=phone,
            contact_person=contact,
            address=address,
            status=status,
        )
        for name, region, email, phone, contact, address, status in CUSTOMERS
    ]
    db.add_all(customers)
    db.flush()

    now = datetime.now(UTC)
    statuses = ["shipped", "processing", "pending", "shipped", "cancelled"]
    # Each order gets 1-3 line items; the total is computed from them.
    order_specs = [
        [(0, 120), (3, 60)],
        [(1, 40), (5, 30)],
        [(2, 80), (7, 25), (8, 100)],
        [(9, 90)],
        [(4, 50), (2, 40)],
        [(6, 35)],
        [(0, 70), (1, 20)],
        [(7, 60), (4, 30), (3, 80)],
        [(8, 40)],
        [(5, 55), (9, 45)],
        [(3, 30), (6, 25)],
        [(1, 60), (2, 50)],
    ]
    for i, spec in enumerate(order_specs):
        items = [
            models.OrderItem(
                product_id=products[pidx].id,
                quantity=qty,
                unit_price=products[pidx].unit_price,
            )
            for pidx, qty in spec
        ]
        total = sum(it.quantity * it.unit_price for it in items)
        db.add(
            models.Order(
                customer_id=customers[i % len(customers)].id,
                status=statuses[i % len(statuses)],
                total=round(total, 2),
                items=items,
                # One distinct day per order so the revenue-trend chart has a
                # real line spanning the recent period (newest = today).
                created_at=now - timedelta(days=(len(order_specs) - 1 - i)),
            )
        )
    db.commit()


def seed(db: Session) -> None:
    seed_users(db)
    seed_business(db)
