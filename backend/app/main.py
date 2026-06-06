"""
FastAPI application entry point.

Exposes the ERP/CRM/WMS APIs plus operational endpoints, mounts Prometheus
metrics (so scalability can be measured — criterion C.M3 / D.M4), and creates
+ seeds the schema on startup once the private-subnet database is reachable.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, make_asgi_app
from starlette.middleware.base import BaseHTTPMiddleware

from .config import get_settings
from .database import init_schema, wait_for_db
from .routers import auth, crm, dashboard, erp, health, users, wms
from .seed import seed

settings = get_settings()

REQUESTS = Counter("app_requests_total", "Total HTTP requests", ["method", "path", "instance"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    wait_for_db()
    # Create the schema and seed demo data exactly once across all replicas
    # (advisory-locked inside init_schema to avoid a startup race).
    init_schema(seed)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        REQUESTS.labels(request.method, request.url.path, settings.instance_id).inc()
        return await call_next(request)


app.add_middleware(MetricsMiddleware)

# Prometheus scrape endpoint
app.mount("/metrics", make_asgi_app())

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(erp.router)
app.include_router(crm.router)
app.include_router(wms.router)


@app.get("/")
def root():
    return {"service": settings.app_name, "instance": settings.instance_id}
