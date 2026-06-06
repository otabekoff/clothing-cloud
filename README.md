# NIMBUS — Cloud Networking Platform for ERP / CRM / WMS

A complete, deployable reference implementation for **BTEC Unit 6: Networking in
the Cloud**. It migrates a wholesale clothing company's ERP, CRM and WMS systems
onto one secure cloud network and demonstrates load balancing, auto-scaling and
a CI/CD pipeline end-to-end.

**Stack:** React 19 + React Router 7 + Recharts + SCSS · Python FastAPI (JWT
auth + RBAC) · PostgreSQL · Docker / Compose · Nginx load balancer ·
GitHub Actions → AWS (EC2 + ECR).

---

## Architecture in one line

A VPC modelled with a **public subnet** (React site + Nginx load balancer) and a
**private subnet** (auto-scalable FastAPI replicas + PostgreSQL that is never
internet-facing). Full diagram and criteria mapping: [`docs/architecture.md`](docs/architecture.md).

---

## Quick start (local, you already have Docker)

```bash
# from the project root
docker compose up --build
```

Then open:

- **http://localhost:8000** — the NIMBUS web app (sign in with a demo account below)
- **http://localhost:8080/health** — backend via the load balancer
- **http://localhost:8080/whoami** — shows which replica answered (refresh to see it change)

### Demo accounts

The app has JWT login with three role grades (RBAC). Click a card on the login
screen to autofill, or use:

| Role | Email | Password | Can do |
|---|---|---|---|
| Admin | `admin@nimbus.dev` | `admin123` | everything, incl. user management |
| Manager | `manager@nimbus.dev` | `manager123` | read + create/edit/delete business records |
| Viewer | `viewer@nimbus.dev` | `viewer123` | read-only across all modules |

> These seeded credentials are for the demo only. Set a strong `JWT_SECRET` and
> replace the demo users before any real use.

### What's in the app

A single-page React app (React Router v7) with a light SaaS dashboard:

- **Dashboard** — KPIs + Recharts visualizations (revenue trend, revenue by
  status, stock by warehouse, products by category)
- **Products (ERP)**, **Stock (WMS)**, **Customers / Orders (CRM)** — full
  create/read/update/delete, gated by role
- **User Management** — admin-only account & role administration

Start with more replicas:

```bash
docker compose up --build --scale backend=4
```

Stop and clean up:

```bash
docker compose down -v
```

---

## Demonstrating load balancing & auto-scaling (Task 1.6)

**Option A — quick proof in a terminal:** hit the load balancer repeatedly and
watch the answering replica rotate.

```bash
# scale up first, then fire a burst
docker compose up -d --scale backend=4
for i in $(seq 1 12); do curl -s http://localhost:8080/whoami | grep -o '"instance":"[^"]*"'; done
```

**Option B — full scaling loop:**

```bash
# terminal 1 — start the stack
docker compose up --build

# terminal 2 — start the CPU-driven auto-scaler (2 → 6 replicas)
./scripts/autoscale.sh

# terminal 3 — generate sustained load
pip install locust
locust -f loadtest/locustfile.py --host http://localhost:8080
#   open http://localhost:8089, set e.g. 200 users, watch:
#     - autoscale.sh adding replicas as CPU passes 60%
#     - docker stats showing CPU spread across new containers
#     - /whoami rotating across the new replicas (curl it in a loop)
```

Capture the Locust latency/throughput numbers before and after scaling — that
comparison is the evidence for criteria **C.D2** and **D.D3**.

---

## Smoke test

```bash
./scripts/smoke-test.sh http://localhost:8000 http://localhost:8080
```

Checks the public site, the LB health endpoint, and that requests reach the
backend replicas. CI runs the same script after deploying.

---

## Run the backend tests (what CI runs)

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

---

## CI/CD → AWS (EC2 + ECR)

`.github/workflows/ci-cd.yml` runs three gated stages on push to `main`:

1. **test** — backend `pytest` + frontend `vite build`
2. **build-and-push** — build the backend / frontend / lb images and push to
   **Amazon ECR**
3. **deploy** — copy `docker-compose.prod.yml` to the **EC2** instance over SSH,
   authenticate to ECR via the instance's IAM role, pull the new images,
   recreate the stack, and run the smoke test

### One-time setup

Full console + CLI walkthrough: **[`docs/aws-deploy.md`](docs/aws-deploy.md)**.
In brief: create three ECR repos, an IAM user for the pipeline (ECR push) and an
IAM role for EC2 (ECR read), launch a `t3.small` instance with a security group
(22 from your IP, 80 open, 8080 from your IP), install Docker + Compose on it,
then add these **GitHub Actions secrets**:

| Secret | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | pipeline pushes to ECR |
| `AWS_REGION` | e.g. `eu-central-1` |
| `AWS_ACCOUNT_ID` | builds the ECR registry URL |
| `EC2_HOST` | instance public IP / Elastic IP / DNS |
| `EC2_USER` | `ec2-user` (Amazon Linux) |
| `EC2_SSH_KEY` | private key for the EC2 key pair |

Then push to `main` — the pipeline deploys automatically and the site is served
on the instance's port 80.

---

## Project layout

```
cloud-erp-platform/
├── docker-compose.yml          # local VPC topology (public/private subnets)
├── docker-compose.prod.yml     # production: pulls images from Amazon ECR
├── .github/workflows/ci-cd.yml # test → build → deploy
├── nginx/                      # Layer-7 load balancer (internet gateway)
├── backend/                    # FastAPI: auth + ERP/CRM/WMS/dashboard routers
│   ├── app/                    #   config, db, models, schemas, security, seed
│   │   └── routers/            #   auth, users, dashboard, erp, crm, wms, health
│   └── tests/                  #   API + auth + RBAC tests run in CI
├── frontend/                   # React 19 SPA · React Router v7 · Recharts · SCSS
│   └── src/{api,auth,components,hooks,pages,styles}
├── loadtest/locustfile.py      # scalability test
├── scripts/                    # autoscale.sh, smoke-test.sh
├── docs/architecture.md        # design + full BTEC criteria mapping
└── docs/aws-deploy.md          # AWS EC2 + ECR setup walkthrough
```

---

## BTEC criteria coverage

| Criterion | Where it's evidenced |
|---|---|
| A.P1 benefits/constraints of cloud network architectures | `docs/architecture.md` §1; public/private subnet design |
| A.M1 compare networking standards | `docs/architecture.md` §1 table |
| A.D1 review effect on implementation/performance | §3 LB + scaling discussion |
| A.P2 how network communication operates in the cloud | §2 request-flow path |
| B.P3 deploy remote OS services in the cloud | Dockerfiles + compose (immutable images) |
| B.M2 impact of remote OS optimisation | §4 multi-stage builds, workers, healthchecks |
| B.P4 how remote clients interact with cloud services | §2; frontend → LB → backend |
| C.P5 design a networked cloud solution | whole topology + `docker-compose.yml` |
| C.P6 implement the networking solution | runnable stack (`docker compose up`) |
| C.M3 test for performance & scalability | Locust test + `/whoami` LB rotation |
| C.D2 justify effectiveness from test results | before/after Locust comparison |
| D.P7 recommend enhancements from test results | §5 connectivity options |
| D.P8 implement enhancements | auto-scaler, least-loaded retry, healthchecks |
| D.M4 test enhancements for further improvement | re-run Locust with auto-scaler on |
| D.D3 justify improvements vs original design | scaling vs fixed-replica comparison |

> Educational reference project for an internship-style assignment scenario. Use
> a managed database and secrets manager rather than the demo defaults before
> any real production use.
