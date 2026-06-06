# AWS Deployment Architecture & Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Repository                      │
│                 otabekoff/clothing-cloud                    │
│  (Backend + Frontend + Nginx + Docker Compose configs)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ├─→ Push to main branch
                           │
                           ↓
        ┌──────────────────────────────────────┐
        │   GitHub Actions CI/CD Pipeline      │
        │                                      │
        │  1. Test (backend + frontend)       │
        │  2. Build & Push to ECR             │
        │  3. SSH Deploy to EC2               │
        └────────────┬─────────────────────────┘
                     │
        ┌────────────┴─────────────────────────────┐
        ↓                                          ↓
   AWS ECR                                    AWS EC2 Instance
   (Docker Images)                            (t3.small)
   ├─ nimbus/backend                         │
   ├─ nimbus/frontend                        ├─ Docker Daemon
   └─ nimbus/lb                              ├─ Docker Compose
                                             │
                                             └─ Services
                                                ├─ PostgreSQL (private)
                                                ├─ Backend x2 (private)
                                                ├─ Nginx LB (public)
                                                └─ Frontend (public)
```

## Deployment Flow

```
1. You push code to GitHub main branch
                    ↓
2. GitHub Actions workflow triggers automatically
   ├─ Test Suite Runs
   │  ├─ Backend: pytest
   │  └─ Frontend: npm build
   │
   ├─ Build & Push (if tests pass)
   │  ├─ Configure AWS credentials
   │  ├─ Log in to ECR
   │  ├─ Build 3 Docker images
   │  └─ Push to ECR repos
   │
   └─ Deploy (if build succeeds)
      ├─ SCP docker-compose.prod.yml to EC2
      ├─ SSH to EC2
      ├─ Authenticate Docker to ECR
      ├─ Pull latest images
      ├─ Run: docker compose up -d
      └─ Run smoke test
```

## Data Flow in Production

```
                    Internet (0.0.0.0/0)
                          ↓
                    ┌─────────────┐
                    │ EC2 Public  │ Port 80 (HTTP) - Frontend
                    │ Security    │ Port 8080 (testing only)
                    │ Group       │
                    └──────┬──────┘
                           ↓
              ┌────────────────────────────┐
              │ Nginx Load Balancer        │
              │ (public_net bridge)        │
              │ :80 → :8080                │
              │ Reverse proxy to backend   │
              └────────────┬───────────────┘
              ↓            ↓
     ┌─────────────┐  ┌────────────┐
     │ Frontend    │  │  Backend   │
     │ (nginx web) │  │ (FastAPI)  │
     │             │  │            │
     │ public_net  │  │private_net │
     └─────────────┘  └──────┬─────┘
                             ↓
                      ┌──────────────┐
                      │ PostgreSQL   │
                      │ (private_net)│
                      │ :5432        │
                      └──────────────┘
```

## Security Model

```
┌─────────────────────────────────────┐
│   AWS Account                       │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ Default VPC                    │ │
│  │                                │ │
│  │  ┌──────────────────────────┐  │ │
│  │  │ EC2 Instance (t3.small)  │  │ │
│  │  │                          │  │ │
│  │  │ Security Group:          │  │ │
│  │  │ ├─ Inbound SSH   :22 (your IP only)        │
│  │  │ ├─ Inbound HTTP  :80 (0.0.0.0/0)           │
│  │  │ └─ Inbound :8080 (your IP only - testing)  │
│  │  │ Outbound: All                 │  │
│  │  │                          │  │
│  │  │ Docker Compose:          │  │
│  │  │ ├─ public_net (bridge)   │  │
│  │  │ │  └─ No host ports      │  │
│  │  │ │     (only :80, :8080)  │  │
│  │  │ │                        │  │
│  │  │ └─ private_net (bridge)  │  │
│  │  │    └─ Backend + DB       │  │
│  │  │       No host ports      │  │
│  │  │                          │  │
│  │  │ IAM Role:                │  │
│  │  │ └─ AmazonEC2            │  │
│  │  │    ContainerRegistry    │  │
│  │  │    ReadOnly             │  │
│  │  └──────────────────────────┘  │
│  │                                │
│  │ ECR Repositories:              │
│  │ ├─ nimbus/backend              │
│  │ ├─ nimbus/frontend             │
│  │ └─ nimbus/lb                   │
│  │                                │
│  └────────────────────────────────┘
│                                     │
│ GitHub Actions User:                │
│ └─ IAM Access Key                  │
│    (ECR push permissions only)      │
│                                     │
└─────────────────────────────────────┘
```

## What Gets Deployed

```
├─ Database (PostgreSQL 16)
│  ├─ Auto-initialized from docker image
│  ├─ Persisted to Docker volume (pgdata)
│  └─ Only accessible from backend (private network)
│
├─ Backend API (FastAPI + Uvicorn)
│  ├─ 2 replicas (configured in docker-compose.prod.yml)
│  ├─ AUTO-SCALES in production
│  ├─ No host ports (only private_net)
│  └─ Talks to nginx and postgres
│
├─ Load Balancer (Nginx)
│  ├─ Layer 7 (application layer)
│  ├─ Reverse proxy to both frontend and backend
│  ├─ Binds to :8080 (for testing)
│  └─ Public/private networks bridge
│
└─ Frontend (Static SPA + Nginx)
   ├─ Built React/Vue/etc. app
   ├─ Served from :80 (public web)
   └─ Public network only
```

## Environment Variables

**On EC2 (~/nimbus/.env):**
```
POSTGRES_USER=erp
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=erp
```

**Set by GitHub Actions workflow:**
```
AWS_REGION=eu-central-1          # from GitHub secret
AWS_ACCOUNT_ID=123456789012      # from GitHub secret
ECR_REGISTRY=123456789012.dkr.ecr.eu-central-1.amazonaws.com
```

## Cost Estimate (EU region, 1 month)

| Resource | Type | Cost |
|----------|------|------|
| t3.small EC2 | compute | ~€7-10 |
| ECR storage | 3 repos, ~500MB | ~€1-2 |
| Data transfer | outbound | minimal |
| **Total** | | **~€10-15/mo** |

> ⚠️ With free tier: may be different. **Stop resources when not in use!**

## Monitoring & Logs

### Docker Compose Logs (on EC2)
```bash
ssh -i key.pem ec2-user@<EC2_IP>
cd ~/nimbus

# See all containers
docker ps

# View logs
docker compose logs -f                    # all services
docker compose logs -f backend            # specific service
docker compose logs -f db                 # database

# Shell into container
docker compose exec backend bash
```

### GitHub Actions Logs
```powershell
# View latest workflow run
gh run view <RUN_ID> --repo otabekoff/clothing-cloud

# View specific job logs
gh run view <RUN_ID> --log-repo otabekoff/clothing-cloud
```

### AWS CloudWatch (optional)
Can add CloudWatch monitoring to EC2 in AWS Console for real production setups.

---

**Ready to deploy? Start with:**
1. `aws configure` — add your credentials
2. `.\scripts\aws-setup.ps1` — create AWS resources
3. Launch EC2 in AWS Console
4. `.\scripts\github-secrets.ps1` — configure GitHub
5. Push code → Automatic deployment!
