"""Pydantic response/request schemas (the public API contract)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    name: str
    category: str
    unit_price: float


class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    warehouse: str
    quantity: int
    product: ProductOut


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    region: str
    email: str


class OrderCreate(BaseModel):
    customer_id: int
    total: float


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    status: str
    total: float
    created_at: datetime
