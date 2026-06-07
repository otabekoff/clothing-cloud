"""
Operational endpoints used by the network layer:

  /health    -> consumed by the Nginx load balancer and Docker healthchecks
  /whoami    -> returns the replica id so the LB demo can prove round-robin
  /api/load  -> burns CPU on demand to trigger the auto-scaling demonstration
"""

import math
import os
import time

from fastapi import APIRouter

from ..config import get_settings

settings = get_settings()
router = APIRouter(tags=["ops"])


@router.get("/health")
def health():
    return {"status": "ok", "instance": settings.instance_id}


@router.get("/whoami")
def whoami():
    """Identifies the container that served this request (load-balancer proof)."""
    return {
        "instance": settings.instance_id,
        "hostname": os.uname().nodename,
        "pid": os.getpid(),
    }


@router.get("/api/load")
def cpu_load(ms: int = 250):
    """
    Spend ~`ms` milliseconds doing real arithmetic. Hammering this endpoint with
    the load test raises CPU, which is the signal the auto-scaler reacts to.
    """
    deadline = time.perf_counter() + (ms / 1000.0)
    iterations = 0
    while time.perf_counter() < deadline:
        math.sqrt(iterations * 1.0000001 + 1)
        iterations += 1
    return {"instance": settings.instance_id, "iterations": iterations, "ms": ms}
