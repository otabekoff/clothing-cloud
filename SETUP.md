# Quick Setup Guide - Cloud ERP Platform on AWS

## Prerequisites Checklist
- [ ] AWS account with credits
- [ ] AWS CLI installed (`aws --version`)
- [ ] GitHub account (repo: otabekoff/clothing-cloud)
- [ ] SSH key pair (for EC2)

---

## Step 0: Configure AWS Credentials

Run this in your terminal:
```powershell
aws configure
```

You'll be prompted for:
- **AWS Access Key ID** — from your AWS IAM user
- **AWS Secret Access Key** — from your IAM user
- **Default region** — pick one: `eu-central-1`, `us-east-1`, or `ap-south-1`
- **Output format** — leave as `json`

Verify it worked:
```powershell
aws sts get-caller-identity
```

---

## Step 1: Run AWS Setup Script

This creates ECR repos, IAM user, and IAM role automatically:

```powershell
cd c:\Users\marko\Downloads\cloud-erp-platform
.\scripts\aws-setup.ps1
```

**Output will include:**
- `AWS_ACCOUNT_ID` (12 digits) — **save this**
- `AWS_ACCESS_KEY_ID` for GitHub Actions — **save this securely**
- `AWS_SECRET_ACCESS_KEY` for GitHub Actions — **save this securely**
- `AWS_REGION` — e.g., `eu-central-1`

---

## Step 2: Launch EC2 Instance (AWS Console)

1. Go to AWS Console → EC2 → **Launch instance**
2. **Name:** `nimbus`
3. **AMI:** Amazon Linux 2023 (free tier option)
4. **Instance type:** `t3.small` (2 GB RAM)
5. **Key pair:** Select or create one (download `.pem` file if creating new)
6. **Network settings** → Create security group with these inbound rules:
   | Type | Port | Source | Purpose |
   |------|------|--------|---------|
   | SSH | 22 | Your IP only | admin access |
   | HTTP | 80 | 0.0.0.0/0 | public website |
   | Custom TCP | 8080 | Your IP only | load balancer testing |

7. **Advanced details** → IAM instance profile: select `nimbus-ec2-ecr`
8. **Launch**
9. Wait ~1 minute, then note the **Public IPv4 address** (or DNS name)

---

## Step 3: Configure EC2 Instance

SSH into the instance and run the setup script:

```bash
ssh -i /path/to/your/key.pem ec2-user@<EC2_PUBLIC_IP>

# Download and run setup
curl -o ~/setup-instance.sh https://raw.githubusercontent.com/otabekoff/clothing-cloud/main/scripts/ec2-setup.sh
bash ~/setup-instance.sh

# Edit .env with a strong password
nano ~/nimbus/.env

# Exit SSH
exit
```

---

## Step 4: Add GitHub Secrets

1. Go to: **GitHub.com** → Your repo (`otabekoff/clothing-cloud`) → **Settings** → **Secrets and variables** → **Actions**
2. Create these secrets (from Step 1 and Step 3 output):

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | from step 1 |
| `AWS_SECRET_ACCESS_KEY` | from step 1 |
| `AWS_REGION` | e.g., `eu-central-1` |
| `AWS_ACCOUNT_ID` | from step 1 |
| `EC2_HOST` | EC2 public IP or DNS |
| `EC2_USER` | `ec2-user` (or `ubuntu` if Ubuntu AMI) |
| `EC2_SSH_KEY` | contents of your `.pem` private key file |

---

## Step 5: Test Deployment

1. Push to `main` branch (or verify latest push):
   ```powershell
   cd c:\Users\marko\Downloads\cloud-erp-platform
   git push
   ```

2. Watch the workflow:
   ```powershell
   gh run list --repo otabekoff/clothing-cloud --workflow ci-cd --limit 1
   gh run view <RUN_ID> --repo otabekoff/clothing-cloud
   ```

3. Once complete, verify at:
   - **Website**: `http://<EC2_PUBLIC_IP>` (frontend)
   - **Health check**: `http://<EC2_PUBLIC_IP>:8080/health` (load balancer)

---

## Troubleshooting

### Workflow fails at "Deploy" step
- Check GitHub Secrets are all present (Settings → Secrets)
- Verify EC2 instance is running
- Check EC2 Security Group allows SSH from GitHub Actions IPs (or use broader rule)

### Docker Compose fails to pull images
- Ensure EC2 role `nimbus-ec2-ecr` is attached
- Verify ECR repos exist: `aws ecr describe-repositories --region <REGION>`

### Cannot SSH to EC2
- Verify `.pem` key has correct permissions: `chmod 600 key.pem`
- Check Security Group SSH rule includes your IP

---

## Cleanup (Stop Costs)

To stop the deployment:

```powershell
$AWS_REGION = "eu-central-1"
$AWS_ACCOUNT_ID = "123456789012"  # replace with yours

# Stop/terminate EC2
aws ec2 terminate-instances --instance-ids <INSTANCE_ID> --region $AWS_REGION

# Delete ECR repos
foreach ($name in @("backend", "frontend", "lb")) {
  aws ecr delete-repository --repository-name "nimbus/$name" --force --region $AWS_REGION
}

# Delete IAM resources
aws iam delete-access-key --access-key-id <ACCESS_KEY> --user-name github-actions-nimbus
aws iam delete-user --user-name github-actions-nimbus
aws iam delete-role-policy --role-name nimbus-ec2-ecr --policy-name AmazonEC2ContainerRegistryReadOnly
aws iam delete-role --role-name nimbus-ec2-ecr
```

---

## Reference Files

- Deployment guide: [docs/aws-deploy.md](../docs/aws-deploy.md)
- CI/CD workflow: [.github/workflows/ci-cd.yml](../.github/workflows/ci-cd.yml)
- Production compose: [docker-compose.prod.yml](../docker-compose.prod.yml)
