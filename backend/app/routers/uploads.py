"""
Image uploads. Files are written to a media directory (mounted as a Docker
volume in production so they survive restarts) and served back as static files
at /media/... by the app. Any authenticated manager+ may upload.
"""

import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from .. import schemas
from ..config import get_settings
from ..security import require_role

settings = get_settings()

MEDIA_DIR = Path(settings.media_dir)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
}
MAX_BYTES = 4 * 1024 * 1024  # 4 MB

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post(
    "",
    response_model=schemas.UploadOut,
    status_code=201,
    dependencies=[Depends(require_role("manager"))],
)
async def upload_image(file: UploadFile = File(...)):
    ext = ALLOWED.get(file.content_type or "")
    if ext is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Use PNG, JPEG, WEBP, GIF or SVG.",
        )

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 4 MB).")

    name = f"{secrets.token_hex(16)}{ext}"
    (MEDIA_DIR / name).write_bytes(data)
    # Served by the StaticFiles mount in main.py at /media.
    return schemas.UploadOut(url=f"/media/{name}")
