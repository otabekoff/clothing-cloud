# Network Architecture — NIMBUS Cloud Platform

This document describes the cloud network design for migrating the wholesale
clothing company's **ERP, CRM and WMS** systems onto a single, secure cloud
network, and maps each design decision to the BTEC Unit 6 assessment criteria.

---

## 1. Logical topology (VPC model)

The deployment is organised as a **Virtual Private Cloud (VPC)** divided into a
public and a private subnet. In this project the VPC is modelled with two
isolated Docker bridge networks:

```
                         Internet / Users
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │  PUBLIC SUBNET  (public_net)                │
        │                                             │
        │   ┌──────────┐        ┌──────────────────┐  │
        │   │ frontend │  ───▶  │  lb (Nginx)       │  │
        │   │  :80     │        │  Load Balancer +  │  │
        │   │  React   │        │  Internet Gateway │  │
        │   └──────────┘        └─────────┬─────────┘  │
        └───────────────────────────────────┼─────────┘
                                             │ (only the LB crosses the boundary)
        ┌───────────────────────────────────┼─────────┐
        │  PRIVATE SUBNET (private_net)       ▼        │
        │   ┌───────────┐ ┌───────────┐ ┌───────────┐ │
        │   │ backend-1 │ │ backend-2 │ │ backend-N │ │  ◀ auto-scaled replicas
        │   │ FastAPI   │ │ FastAPI   │ │ FastAPI   │ │     (ERP/CRM/WMS tier)
        │   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ │
        │         └─────────────┼─────────────┘       │
        │                       ▼                      │
        │                 ┌───────────┐                │
        │                 │    db     │  ◀ data tier, never internet-facing
        │                 │ Postgres  │                │
        │                 └───────────┘                │
        └──────────────────────────────────────────────┘
```

| Brief concept            | Implemented as                                             |
|--------------------------|------------------------------------------------------------|
| VPC                      | The pair of isolated Docker networks                       |
| Public subnet            | `public_net` (frontend, lb)                                |
| Private subnet           | `private_net` (backend replicas, database)                 |
| Internet Gateway         | `lb` published port → only ingress point                   |
| Load Balancer            | Nginx re-resolving the `backend` service across replicas   |
| NAT (egress)             | Docker bridge SNAT lets private containers reach updates   |
| Firewall / segmentation  | Network membership: db is on `private_net` only            |
| DNS                      | Docker embedded DNS (127.0.0.11) resolving service names   |

The database is attached to `private_net` **only** and publishes **no ports**,
so it is unreachable from the host or the internet. The backend tier likewise
publishes no ports — the *only* way in is through the load balancer. This is the
defence-in-depth posture argued for under criterion **A.P1** and hardened
further in **D**.

---

## 2. How requests flow (criterion A.P2, B.P4)

1. A remote client (browser at head office, a regional warehouse, or a remote
   employee over VPN) requests the public site from `frontend:80`.
2. The React SPA calls `/api/...`. Nginx in the frontend container reverse-proxies
   those calls to the load balancer (`lb:8080`) — same-origin, so no CORS issues
   in production.
3. The load balancer re-resolves the `backend` DNS name on each request and
   forwards to one of the live FastAPI replicas (least-loaded selection via
   `proxy_next_upstream` retries on busy replicas).
4. The chosen replica reads/writes PostgreSQL over the private network and
   returns JSON. The `/whoami` field lets the UI prove *which* replica answered.

This is the "remote client interacts with cloud services" path required by
**B.P4**, and the "network communication within the cloud" required by **A.P2**.

---

## 3. Load balancing & auto-scaling (Task 1.6, criteria C.M3 / D.M4)

**Load balancing.** Open-source Nginx cannot use the Plus-only `resolve` flag on
upstream servers, so the config uses a variable in `proxy_pass` plus a `resolver`
pointed at Docker's embedded DNS. Docker returns the full set of replica IPs in
round-robin order and Nginx re-resolves every 5 seconds. The practical effect:
new replicas receive traffic automatically, with no reload.

**Auto-scaling.** `scripts/autoscale.sh` polls the average CPU of the backend
replicas via `docker stats` and scales the replica count between `MIN=2` and
`MAX=6`:

- avg CPU ≥ 60 % → add a replica
- avg CPU ≤ 20 % → remove a replica

Because the LB picks up replicas within ~5 s, added capacity starts absorbing
load immediately. This is the horizontal-scaling behaviour demonstrated for
**C.M3** (test for performance & scalability) and **D.M4** (test enhancements).

**Evidence to capture for C.D2 / D.D3.** Run the Locust test, record latency and
throughput at a fixed user count with `replicas=2`, then again while the
auto-scaler is running, and compare. The improvement in p95 latency and the
absence of errors under sustained load is the justification those criteria ask
for.

---

## 4. Remote OS / service deployment (criteria B.P3, B.M2)

Each tier ships as an immutable container image (a "remote operating system
service" deployed into the cloud — **B.P3**). Optimisations relevant to **B.M2**:

- **Multi-stage builds** — the frontend is compiled in a Node image, then only
  the static assets are copied into a tiny Nginx runtime image.
- **Layer caching** — dependencies are installed before app code is copied, so
  rebuilds are fast.
- **Non-root runtime** and **healthchecks** on every container.
- **2 Uvicorn workers per replica** — vertical concurrency inside each horizontal
  unit, so CPU cores are used before new replicas are spun up.

---

## 5. Connectivity options (Learning aim D comparisons)

The brief asks for comparisons; the design takes the following positions:

- **On-prem vs in-cloud vs hybrid** → in-cloud for ERP/CRM/WMS, because the load
  is spiky (order peaks) and benefits from elastic scaling the company can't get
  from fixed local servers.
- **IaaS vs PaaS vs SaaS** → IaaS (AWS EC2 + containers) for full
  control of the network topology this assignment requires; a production
  follow-on could move stateless tiers to a PaaS.
- **Public vs private vs multi-cloud** → public cloud with private subnets for
  the sensitive data tier; multi-cloud deferred to avoid early complexity.
- **Site-to-Site vs Client-to-Site VPN** → Site-to-Site to join head office and
  regional warehouses to the VPC; Client-to-Site for remote employees.
- **VMs vs containers** → containers (Docker), for density, fast scaling and
  identical images across environments.

These map to Learning aim D's comparison tasks and the recommendations in
**D.P7 / D.P8**.
