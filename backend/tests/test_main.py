"""
Minimal API tests executed in the GitHub Actions CI stage (criterion C.M3).
Uses an in-memory SQLite database so CI needs no external services.
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

# The FastAPI lifespan (which creates + seeds tables) only fires when TestClient
# is used as a context manager. We set the schema up directly so the simple
# module-level client below has data to read.
Base.metadata.create_all(bind=test_engine)
_session = database.SessionLocal()
try:
    seed_data(_session)
finally:
    _session.close()

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_whoami_reports_instance():
    r = client.get("/whoami")
    assert r.status_code == 200
    assert "instance" in r.json()


def test_seeded_products_present():
    r = client.get("/api/erp/products")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_create_order():
    customers = client.get("/api/crm/customers").json()
    cid = customers[0]["id"]
    r = client.post("/api/crm/orders", json={"customer_id": cid, "total": 100.0})
    assert r.status_code == 201
    assert r.json()["status"] == "pending"
