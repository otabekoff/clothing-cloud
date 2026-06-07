"""
Authentication & authorization helpers.

Password hashing (bcrypt via passlib), JWT creation/verification (python-jose),
and FastAPI dependencies that enforce role-based access control (RBAC). The
three roles, least → most privilege, are: viewer, manager, admin.
"""

from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models
from .config import get_settings
from .database import get_db

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# tokenUrl is the login endpoint; Swagger uses it for the "Authorize" button.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Role privilege ordering. A user satisfies a requirement if their rank >= it.
ROLE_RANK = {"viewer": 1, "manager": 2, "admin": 3}


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    """Decode the bearer token and load the active user it identifies."""
    creds_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        email: str | None = payload.get("sub")
        if email is None:
            raise creds_error
    except JWTError as exc:
        raise creds_error from exc

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None or not user.is_active:
        raise creds_error
    return user


def require_role(minimum: str):
    """Dependency factory: require at least `minimum` role to proceed.

    Usage:  @router.post(..., dependencies=[Depends(require_role("manager"))])
    """
    required_rank = ROLE_RANK[minimum]

    def checker(user: models.User = Depends(get_current_user)) -> models.User:
        if ROLE_RANK.get(user.role, 0) < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum}' role or higher",
            )
        return user

    return checker
