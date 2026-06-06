"""Pydantic response/request schemas (the public API contract)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["viewer", "manager", "admin"]


# ── Auth & users ─────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    role: Role = "viewer"
    password: str = Field(min_length=6)


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6)


# ── ERP / products ───────────────────────────────────────────────
class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    name: str
    category: str
    unit_price: float


class ProductCreate(BaseModel):
    sku: str
    name: str
    category: str
    unit_price: float = Field(ge=0)


class ProductUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    category: str | None = None
    unit_price: float | None = Field(default=None, ge=0)


# ── WMS / stock ──────────────────────────────────────────────────
class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    warehouse: str
    quantity: int
    product: ProductOut


class StockCreate(BaseModel):
    product_id: int
    warehouse: str
    quantity: int = Field(ge=0)


class StockUpdate(BaseModel):
    warehouse: str | None = None
    quantity: int | None = Field(default=None, ge=0)


# ── CRM / customers & orders ─────────────────────────────────────
class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    region: str
    email: EmailStr


class CustomerCreate(BaseModel):
    name: str
    region: str
    email: EmailStr


class CustomerUpdate(BaseModel):
    name: str | None = None
    region: str | None = None
    email: EmailStr | None = None


OrderStatus = Literal["pending", "processing", "shipped", "cancelled"]


class OrderCreate(BaseModel):
    customer_id: int
    total: float = Field(ge=0)
    status: OrderStatus = "pending"


class OrderUpdate(BaseModel):
    status: OrderStatus | None = None
    total: float | None = Field(default=None, ge=0)


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    status: str
    total: float
    created_at: datetime


# ── Dashboard analytics ──────────────────────────────────────────
class KpiSummary(BaseModel):
    products: int
    total_stock: int
    customers: int
    orders: int
    revenue: float
    low_stock_items: int


class NamedValue(BaseModel):
    name: str
    value: float


class DashboardData(BaseModel):
    kpis: KpiSummary
    revenue_by_status: list[NamedValue]
    stock_by_warehouse: list[NamedValue]
    products_by_category: list[NamedValue]
    orders_trend: list[NamedValue]
