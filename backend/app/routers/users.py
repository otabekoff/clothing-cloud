"""User administration. All endpoints require the `admin` role."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import hash_password, require_role

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(require_role("admin"))],
)


@router.get("", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


@router.post("", response_model=schemas.UserOut, status_code=201)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = models.User(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        user.hashed_password = hash_password(data.pop("password"))
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(require_role("admin")),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    db.delete(user)
    db.commit()
