"""
Database engine and session factory.

The engine connects to PostgreSQL over the PRIVATE Docker network only. The
connection is retried on startup because, in a cloud environment, the database
service may become reachable a few seconds after the application container
starts (ordering is not guaranteed across a network).
"""

import time

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import get_settings

settings = get_settings()

# SQLite (used only by the CI unit tests) doesn't accept connection-pool sizing
# args, so apply them only for real networked databases like PostgreSQL.
_engine_kwargs: dict = {"pool_pre_ping": True}
if not settings.database_url.startswith("sqlite"):
    _engine_kwargs.update(pool_size=5, max_overflow=10)

engine = create_engine(settings.database_url, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a scoped session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_schema(seed_fn) -> None:
    """Create tables and seed data exactly once, even with multiple replicas.

    Every backend replica runs this on startup. A Postgres advisory lock
    serialises them so they don't race on `CREATE TABLE` / seeding (which
    previously caused a "relation already exists" crash on the loser). SQLite
    (used by the unit tests) has no advisory locks and runs single-process, so
    we just create + seed directly there.
    """
    is_postgres = settings.database_url.startswith("postgresql")

    if not is_postgres:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_fn(db)
        finally:
            db.close()
        return

    # Arbitrary but stable lock key shared by all replicas. Hold the advisory
    # lock on a dedicated connection while a separate session does the work, so
    # only one replica creates/seeds at a time and the loser waits, then no-ops.
    lock_key = 909_001
    lock_conn = engine.connect()
    try:
        lock_conn.exec_driver_sql(f"SELECT pg_advisory_lock({lock_key})")
        Base.metadata.create_all(bind=engine)
        _backfill_columns()  # add columns added after the table first existed
        db = SessionLocal()
        try:
            seed_fn(db)
        finally:
            db.close()
    finally:
        lock_conn.exec_driver_sql(f"SELECT pg_advisory_unlock({lock_key})")
        lock_conn.close()


# Columns introduced after a table's initial release. `create_all` creates new
# tables but never alters existing ones, so a long-lived Postgres volume keeps
# the old shape. This lightweight, idempotent backfill adds them in place
# (Postgres `ADD COLUMN IF NOT EXISTS`), preserving existing data — enough for
# this project without pulling in a full migration tool like Alembic.
_COLUMN_BACKFILL: dict[str, list[str]] = {
    "users": [
        "avatar_url VARCHAR(255)",
    ],
    "products": [
        "description TEXT",
        "cost_price DOUBLE PRECISION DEFAULT 0",
        "supplier VARCHAR(120)",
        "reorder_level INTEGER DEFAULT 100",
        "image_url VARCHAR(255)",
        "is_active BOOLEAN DEFAULT TRUE",
        "created_at TIMESTAMPTZ DEFAULT now()",
    ],
    "stock_items": [
        "bin_location VARCHAR(40)",
        "reorder_level INTEGER DEFAULT 150",
        "updated_at TIMESTAMPTZ DEFAULT now()",
    ],
    "customers": [
        "phone VARCHAR(40)",
        "contact_person VARCHAR(120)",
        "address TEXT",
        "status VARCHAR(20) DEFAULT 'active'",
        "notes TEXT",
        "logo_url VARCHAR(255)",
        "created_at TIMESTAMPTZ DEFAULT now()",
    ],
    "orders": [
        "notes TEXT",
    ],
}


def _backfill_columns() -> None:
    with engine.begin() as conn:
        for table, columns in _COLUMN_BACKFILL.items():
            for col_def in columns:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col_def}")


def wait_for_db(retries: int = 20, delay: float = 1.5) -> None:
    """Block until the database in the private subnet accepts connections."""
    last_error = None
    for _attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.exec_driver_sql("SELECT 1")
            return
        except OperationalError as exc:  # network/DB not ready yet
            last_error = exc
            time.sleep(delay)
    raise RuntimeError(f"Database unreachable after {retries} attempts: {last_error}")
