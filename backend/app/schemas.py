"""Pydantic response/request schemas (the public API contract)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["viewer", "manager", "admin"]
OrderStatus = Literal["pending", "processing", "shipped", "cancelled"]
CustomerStatus = Literal["active", "inactive", "prospect"]


# ── Auth & users ─────────────────────────────────────────────────
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str
    role: Role
    is_active: bool
    avatar_url: str | None = None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    role: Role = "viewer"
    password: str = Field(min_length=6)
    avatar_url: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6)
    avatar_url: str | None = None


class ProfileUpdate(BaseModel):
    """Self-service update for the logged-in user (no role change)."""

    full_name: str | None = None
    avatar_url: str | None = None
    password: str | None = Field(default=None, min_length=6)


# ── ERP / products ───────────────────────────────────────────────
class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    name: str
    category: str
    description: str | None = None
    unit_price: float
    cost_price: float
    supplier: str | None = None
    reorder_level: int
    image_url: str | None = None
    is_active: bool
    created_at: datetime


class ProductCreate(BaseModel):
    sku: str
    name: str
    category: str
    description: str | None = None
    unit_price: float = Field(ge=0)
    cost_price: float = Field(default=0, ge=0)
    supplier: str | None = None
    reorder_level: int = Field(default=100, ge=0)
    image_url: str | None = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    category: str | None = None
    description: str | None = None
    unit_price: float | None = Field(default=None, ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    supplier: str | None = None
    reorder_level: int | None = Field(default=None, ge=0)
    image_url: str | None = None
    is_active: bool | None = None


# ── WMS / stock ──────────────────────────────────────────────────
class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    warehouse: str
    bin_location: str | None = None
    quantity: int
    reorder_level: int
    updated_at: datetime
    product: ProductOut


class StockCreate(BaseModel):
    product_id: int
    warehouse: str
    bin_location: str | None = None
    quantity: int = Field(ge=0)
    reorder_level: int = Field(default=150, ge=0)


class StockUpdate(BaseModel):
    warehouse: str | None = None
    bin_location: str | None = None
    quantity: int | None = Field(default=None, ge=0)
    reorder_level: int | None = Field(default=None, ge=0)


# ── CRM / customers ──────────────────────────────────────────────
class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    region: str
    email: EmailStr
    phone: str | None = None
    contact_person: str | None = None
    address: str | None = None
    status: CustomerStatus
    notes: str | None = None
    logo_url: str | None = None
    created_at: datetime


class CustomerCreate(BaseModel):
    name: str
    region: str
    email: EmailStr
    phone: str | None = None
    contact_person: str | None = None
    address: str | None = None
    status: CustomerStatus = "active"
    notes: str | None = None
    logo_url: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    region: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    contact_person: str | None = None
    address: str | None = None
    status: CustomerStatus | None = None
    notes: str | None = None
    logo_url: str | None = None


# ── CRM / orders & line items ────────────────────────────────────
class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(ge=1)
    unit_price: float | None = Field(default=None, ge=0)  # default: product price


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    unit_price: float
    product: ProductOut


class OrderCreate(BaseModel):
    customer_id: int
    status: OrderStatus = "pending"
    notes: str | None = None
    items: list[OrderItemIn] = Field(default_factory=list)
    # Used only when no line items are given (kept for backward compatibility).
    total: float | None = Field(default=None, ge=0)


class OrderUpdate(BaseModel):
    status: OrderStatus | None = None
    notes: str | None = None
    items: list[OrderItemIn] | None = None
    total: float | None = Field(default=None, ge=0)


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    status: str
    total: float
    notes: str | None = None
    created_at: datetime
    items: list[OrderItemOut] = Field(default_factory=list)


# ── Uploads ──────────────────────────────────────────────────────
class UploadOut(BaseModel):
    url: str


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
