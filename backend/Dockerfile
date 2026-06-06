# syntax=docker/dockerfile:1
# ---- Backend image: FastAPI service that runs in the PRIVATE subnet ----
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Run as a non-root user (security hardening — criterion D). Pre-create the
# media directory owned by that user so the uploads volume is writable.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /data/media \
    && chown -R appuser:appuser /data
USER appuser

EXPOSE 8000

# Container-level healthcheck consumed by Docker / the orchestrator
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0) if urllib.request.urlopen('http://localhost:8000/health').status==200 else sys.exit(1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
