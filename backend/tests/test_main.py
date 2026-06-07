"""
API tests executed in the GitHub Actions CI stage (criterion C.M3).
Uses an in-memory SQLite database so CI needs no external services. Covers the
ops endpoints, JWT auth, RBAC enforcement, and a CRUD round-trip.
"""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from fastapi.testclient import TestClient  # noqa: E402

# NOTE: SQLite is only used for the unit tests; production uses PostgreSQL.
import app.database as database  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

test_engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
database.engine = test_engine
database.SessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)
database.wait_for_db = lambda *a, **k: None  # no network DB in CI

from app.main import app  # noqa: E402
from app.database import Base  # noqa: E402
from app.seed import seed as seed_data  # noqa: E402

Base.metadata.create_all(bind=test_engine)
_session = database.SessionLocal()
try:
    seed_data(_session)
finally:
    _session.close()

client = TestClient(app)


def token(email: str, password: str) -> str:
    r = client.post("/api/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth(email: str, password: str) -> dict:
    return {"Authorization": f"Bearer {token(email, password)}"}


# ── Ops endpoints (no auth) ──────────────────────────────────────
def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_whoami_reports_instance():
    r = client.get("/whoami")
    assert r.status_code == 200
    assert "instance" in r.json()


# ── Auth ─────────────────────────────────────────────────────────
def test_login_returns_token_and_user():
    r = client.post(
        "/api/auth/login", data={"username": "admin@nimbus.dev", "password": "admin123"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "admin"


def test_login_rejects_bad_password():
    r = client.post("/api/auth/login", data={"username": "admin@nimbus.dev", "password": "wrong"})
    assert r.status_code == 401


def test_protected_endpoint_requires_token():
    assert client.get("/api/erp/products").status_code == 401


# ── Data access with auth ────────────────────────────────────────
def test_seeded_products_present():
    r = client.get("/api/erp/products", headers=auth("viewer@nimbus.dev", "viewer123"))
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_dashboard_returns_kpis():
    r = client.get("/api/dashboard", headers=auth("viewer@nimbus.dev", "viewer123"))
    assert r.status_code == 200
    assert "kpis" in r.json()
    assert r.json()["kpis"]["products"] >= 1


# ── RBAC ─────────────────────────────────────────────────────────
def test_viewer_cannot_create_product():
    r = client.post(
        "/api/erp/products",
        headers=auth("viewer@nimbus.dev", "viewer123"),
        json={"sku": "X-1", "name": "x", "category": "Tops", "unit_price": 1.0},
    )
    assert r.status_code == 403


def test_manager_can_create_order():
    customers = client.get(
        "/api/crm/customers", headers=auth("manager@nimbus.dev", "manager123")
    ).json()
    cid = customers[0]["id"]
    r = client.post(
        "/api/crm/orders",
        headers=auth("manager@nimbus.dev", "manager123"),
        json={"customer_id": cid, "total": 100.0},
    )
    assert r.status_code == 201
    assert r.json()["status"] == "pending"


def test_viewer_cannot_list_users():
    r = client.get("/api/users", headers=auth("viewer@nimbus.dev", "viewer123"))
    assert r.status_code == 403


def test_admin_can_list_users():
    r = client.get("/api/users", headers=auth("admin@nimbus.dev", "admin123"))
    assert r.status_code == 200
    assert len(r.json()) >= 3


# ── Orders with line items ───────────────────────────────────────
def test_order_total_computed_from_line_items():
    h = auth("manager@nimbus.dev", "manager123")
    customers = client.get("/api/crm/customers", headers=h).json()
    products = client.get("/api/erp/products", headers=h).json()
    p = products[0]
    r = client.post(
        "/api/crm/orders",
        headers=h,
        json={
            "customer_id": customers[0]["id"],
            "items": [{"product_id": p["id"], "quantity": 3}],
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert len(body["items"]) == 1
    assert body["total"] == round(3 * p["unit_price"], 2)


def test_rich_product_fields_persist():
    h = auth("manager@nimbus.dev", "manager123")
    r = client.post(
        "/api/erp/products",
        headers=h,
        json={
            "sku": "RICH-1",
            "name": "Rich Product",
            "category": "Tops",
            "unit_price": 9.99,
            "cost_price": 4.0,
            "supplier": "ACME",
            "reorder_level": 50,
            "description": "has fields",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["supplier"] == "ACME"
    assert body["reorder_level"] == 50
    assert body["description"] == "has fields"


# ── Profile self-service ─────────────────────────────────────────
def test_user_can_update_own_profile():
    h = auth("viewer@nimbus.dev", "viewer123")
    r = client.patch("/api/auth/me", headers=h, json={"full_name": "Vera V. Updated"})
    assert r.status_code == 200
    assert r.json()["full_name"] == "Vera V. Updated"
