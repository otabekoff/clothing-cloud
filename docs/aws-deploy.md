# Deploying NIMBUS to AWS (EC2 + Docker Compose + ECR)

A step-by-step, console + CLI guide to run this project on AWS using your
credits. Images are stored in **Amazon ECR**; the stack runs on a single
**EC2** instance via Docker Compose, and **GitHub Actions** builds and deploys
on every push to `main`.

> Pick a region close to you and use it everywhere below. Good options from
> Central Asia: `me-central-1` (UAE), `eu-central-1` (Frankfurt), or
> `ap-south-1` (Mumbai). This guide uses **`eu-central-1`** as the placeholder —
> replace it consistently.

---

## How this maps to the brief's networking concepts

Even on the "single EC2 + Compose" path you are using real AWS networking, which
you can cite in your report:

| Brief concept       | On AWS in this setup                                              |
|---------------------|------------------------------------------------------------------|
| VPC                 | The account's **default VPC** the instance launches into          |
| Public subnet       | The default-VPC subnet with a route to the Internet Gateway       |
| Internet Gateway    | The default VPC's IGW — gives the instance its public IP          |
| Firewall            | The EC2 **Security Group** (inbound rules you define in step 4)   |
| Load balancer       | The Nginx `lb` container inside the instance (Layer 7)            |
| Private subnet      | The `private_net` Docker network (db + backend, no host ports)    |
| Image registry      | **Amazon ECR**                                                    |
| DNS                 | The instance's public DNS name (optionally Route 53 later)        |

The two Docker networks keep the database and backend off any host port, so the
only way into the application tier is through the load balancer — the same
defence-in-depth argument as before, now sitting inside a real AWS VPC.

---

## Prerequisites

- An AWS account with credits and the **AWS CLI** installed locally
  (`aws --version`), authenticated with `aws configure`.
- An SSH key pair you control (you'll register the public key with EC2).
- This repository pushed to GitHub.

Set a couple of shell variables locally to make the commands copy-pasteable:

```bash
export AWS_REGION=eu-central-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
echo "$ECR_REGISTRY"
```

---

## Step 1 — Create the ECR repositories (CLI)

Three repos under a `nimbus/` namespace, one per image:

```bash
for name in backend frontend lb; do
  aws ecr create-repository \
    --repository-name "nimbus/$name" \
    --region "$AWS_REGION" \
    --image-scanning-configuration scanOnPush=true >/dev/null \
    && echo "created nimbus/$name"
done
```

(Re-running is harmless — it just errors that the repo exists.)

---

## Step 2 — IAM: a user for GitHub Actions (push to ECR)

The pipeline needs credentials that can push images.

**Console:** IAM → Users → *Create user* (e.g. `github-actions-nimbus`),
**no console access**. Then attach an inline policy (*Add permissions →
Create inline policy → JSON*):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ],
      "Resource": "arn:aws:ecr:*:*:repository/nimbus/*"
    }
  ]
}
```

Then **Security credentials → Create access key → Application running outside
AWS**. Copy the **Access key ID** and **Secret access key** — you'll add them to
GitHub in step 7.

> More secure alternative: GitHub OIDC with an IAM role instead of a long-lived
> key. The pipeline works with either; this guide uses the key for simplicity.

---

## Step 3 — IAM: a role for the EC2 instance (pull from ECR)

So the instance can pull images without storing keys.

**Console:** IAM → Roles → *Create role* → Trusted entity **AWS service →
EC2** → attach the managed policy **`AmazonEC2ContainerRegistryReadOnly`** →
name it `nimbus-ec2-ecr` → create. You'll attach it to the instance in step 4.

---

## Step 4 — Launch the EC2 instance (console)

EC2 → *Launch instance*:

1. **Name:** `nimbus`
2. **AMI:** Amazon Linux 2023 (pick the current one shown — don't hardcode an ID).
3. **Instance type:** `t3.small` (2 GB RAM). `t2.micro` (free tier) is tight for
   Postgres + several containers; `t3.small` is the comfortable minimum.
4. **Key pair:** select/create your SSH key pair.
5. **Network settings → Security group**, create with these inbound rules:
   | Type        | Port | Source            | Why                          |
   |-------------|------|-------------------|------------------------------|
   | SSH         | 22   | **My IP**         | admin access only            |
   | HTTP        | 80   | Anywhere (0.0.0.0/0) | the public website        |
   | Custom TCP  | 8080 | **My IP**         | load balancer (testing only) |

   Leave the database/backend with **no** inbound rule — they are never exposed.
6. **Advanced details → IAM instance profile:** select `nimbus-ec2-ecr`.
7. **Launch.** Note the instance's **Public IPv4 address** and **Public DNS**.

> Optional but recommended: allocate an **Elastic IP** and associate it so the
> address survives reboots (EC2 → Elastic IPs → Allocate → Associate).

---

## Step 5 — Install Docker, Compose & AWS CLI on the instance (SSH)

```bash
ssh -i /path/to/key.pem ec2-user@<EC2_PUBLIC_IP>

# Docker engine
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# Docker Compose v2 plugin
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p "$DOCKER_CONFIG/cli-plugins"
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"

# AWS CLI v2 (for the ECR login during deploy)
sudo dnf install -y awscli || true   # AL2023 usually ships it; otherwise install v2 manually

# log out/in so the docker group applies, then verify
exit
```

Reconnect and check:

```bash
ssh -i /path/to/key.pem ec2-user@<EC2_PUBLIC_IP>
docker version && docker compose version && aws --version
```

---

## Step 6 — Project directory + secrets on the instance

```bash
mkdir -p ~/nimbus && cd ~/nimbus
cat > .env <<EOF
POSTGRES_USER=erp
POSTGRES_PASSWORD=change-me-strong
POSTGRES_DB=erp
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
EOF
```

The pipeline copies `docker-compose.prod.yml` and the smoke-test script here on
each deploy; `ECR_REGISTRY` is exported by the deploy job at run time.

---

## Step 7 — Add GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | from step 2 |
| `AWS_SECRET_ACCESS_KEY` | from step 2 |
| `AWS_REGION` | e.g. `eu-central-1` |
| `AWS_ACCOUNT_ID` | your 12-digit account id |
| `EC2_HOST` | instance public IP (or Elastic IP / DNS) |
| `EC2_USER` | `ec2-user` (Amazon Linux) |
| `EC2_SSH_KEY` | the **private** key matching the EC2 key pair |

---

## Step 8 — Deploy

Push to `main`. The pipeline runs test → build/push to ECR → SSH-deploy → smoke
test. Watch it under the repo's **Actions** tab.

Prefer a first run by hand? From your laptop:

```bash
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

for svc in backend frontend nginx; do
  name=$svc; [ "$svc" = "nginx" ] && name=lb
  docker build -t "$ECR_REGISTRY/nimbus/$name:latest" "./$svc"
  docker push "$ECR_REGISTRY/nimbus/$name:latest"
done

# then on the instance:
scp -i key.pem docker-compose.prod.yml scripts/smoke-test.sh ec2-user@<IP>:~/nimbus/
ssh -i key.pem ec2-user@<IP> '
  cd ~/nimbus
  export AWS_REGION='"$AWS_REGION"' ECR_REGISTRY='"$ECR_REGISTRY"'
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
  ECR_REGISTRY=$ECR_REGISTRY docker compose -f docker-compose.prod.yml up -d
'
```

---

## Step 9 — Verify

Open **`http://<EC2_PUBLIC_IP>/`** in a browser — the NIMBUS console should load.
From the instance:

```bash
curl -s http://localhost/health
curl -s http://localhost:8080/whoami   # refresh a few times to see replicas rotate
./scripts/smoke-test.sh http://localhost http://localhost:8080
```

Demonstrate scaling exactly as locally (the auto-scaler and Locust steps in the
main README work unchanged on the instance):

```bash
docker compose -f docker-compose.prod.yml up -d --scale backend=4
```

---

## Step 10 — Optional hardening (good "enhancements" evidence for criterion D)

- **Elastic IP** so the address is stable (step 4 note).
- **HTTPS:** put an AWS Application Load Balancer + ACM certificate in front, or
  terminate TLS in the frontend Nginx with a Let's Encrypt cert.
- **Route 53** to point a domain at the instance (the brief's DNS requirement).
- Tighten the security group: drop the `8080` rule once testing is done.

---

## Cost & teardown

A `t3.small` plus a little ECR storage is modest against credits, but stop it
when idle. To tear everything down:

```bash
# on the instance
docker compose -f docker-compose.prod.yml down -v

# from your laptop
aws ec2 terminate-instances --instance-ids <id> --region "$AWS_REGION"
for name in backend frontend lb; do
  aws ecr delete-repository --repository-name "nimbus/$name" --force --region "$AWS_REGION"
done
```

Also release any Elastic IP you allocated (you're billed for unattached EIPs).
