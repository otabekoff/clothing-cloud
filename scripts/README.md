# AWS Deployment Scripts

This directory contains automated scripts to deploy the Cloud ERP Platform to AWS using EC2 + ECR + GitHub Actions.

## Quick Start

### 1. Configure AWS Credentials
```powershell
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and preferred region (e.g., eu-central-1)
```

### 2. Run AWS Setup (creates ECR repos, IAM user, IAM role)
```powershell
.\aws-setup.ps1
```

**Output will show:**
- `AWS_ACCOUNT_ID` — **save this**
- `AWS_ACCESS_KEY_ID` — **save this**
- `AWS_SECRET_ACCESS_KEY` — **save this**

### 3. Launch EC2 Instance (AWS Console)

Go to AWS Console → EC2 → **Launch instance**:
- **Name:** `nimbus`
- **AMI:** Amazon Linux 2023
- **Instance type:** `t3.small`
- **Key pair:** Select your SSH key
- **Security group inbound rules:**
  - SSH (port 22) from your IP
  - HTTP (port 80) from 0.0.0.0/0
  - Custom TCP (port 8080) from your IP
- **IAM instance profile:** `nimbus-ec2-ecr`

After launch, note the **Public IPv4 address**.

### 4. Configure EC2 Instance
```bash
ssh -i /path/to/key.pem ec2-user@<EC2_PUBLIC_IP>
bash /dev/stdin < <(curl -s https://raw.githubusercontent.com/otabekoff/clothing-cloud/main/scripts/ec2-setup.sh)
# Edit the .env file with a strong Postgres password
nano ~/nimbus/.env
exit
```

### 5. Add GitHub Secrets
```powershell
.\github-secrets.ps1 `
  -AccountId "123456789012" `
  -AccessKeyId "AKIA..." `
  -SecretAccessKey "wJal..." `
  -Region "eu-central-1" `
  -Ec2Host "192.0.2.1" `
  -Ec2User "ec2-user" `
  -Ec2KeyPath "C:\path\to\key.pem"
```

### 6. Trigger Deployment
```powershell
git push origin main
# Watch the workflow
gh run list --repo otabekoff/clothing-cloud --workflow ci-cd
```

---

## Scripts Reference

### `aws-setup.ps1`
Creates all AWS resources needed for deployment:
- **ECR Repositories:** `nimbus/backend`, `nimbus/frontend`, `nimbus/lb`
- **IAM User:** `github-actions-nimbus` with ECR push permissions
- **IAM Role:** `nimbus-ec2-ecr` for EC2 instances
- **Access Keys:** For GitHub Actions to push images to ECR

**Prerequisites:**
- AWS CLI installed and authenticated (`aws configure`)
- IAM permissions to create ECR repositories, IAM users, and roles

**Output:**
- AWS Account ID
- AWS Access Key ID and Secret
- ECR Registry URL

### `ec2-setup.sh`
Configures EC2 instance for deployment:
- Installs Docker and Docker Compose v2
- Installs AWS CLI v2
- Creates deployment directory (`~/nimbus`)
- Creates `.env` file for Postgres credentials

**Prerequisites:**
- EC2 instance running (Amazon Linux 2023 or Ubuntu)
- IAM role attached (`nimbus-ec2-ecr`)
- SSH access

**Manual steps after:**
- Edit `~/nimbus/.env` and set a strong `POSTGRES_PASSWORD`
- Log out/in to apply docker group permissions

### `github-secrets.ps1`
Adds deployment secrets to GitHub repository:
- AWS credentials (Access Key ID, Secret Access Key)
- AWS Account ID and Region
- EC2 host, user, and SSH private key

**Prerequisites:**
- GitHub CLI authenticated (`gh auth login`)
- All information from previous scripts

**Usage:**
```powershell
.\github-secrets.ps1 `
  -AccountId "<12-digit-account-id>" `
  -AccessKeyId "<AWS_ACCESS_KEY_ID>" `
  -SecretAccessKey "<AWS_SECRET_ACCESS_KEY>" `
  -Region "<AWS_REGION>" `
  -Ec2Host "<EC2_PUBLIC_IP_OR_DNS>" `
  -Ec2User "ec2-user" `
  -Ec2KeyPath "C:\path\to\key.pem"
```

---

## Architecture

```
GitHub Push (main branch)
    ↓
GitHub Actions Workflow (ci-cd)
    ↓
[Test] Backend unit tests + Frontend build
    ↓
[Build & Push] Build Docker images → Amazon ECR
    ↓
[Deploy] SSH to EC2 → Pull images → docker-compose up
    ↓
EC2 Instance (docker-compose.prod.yml)
    ├─ Postgres (private network)
    ├─ Backend (private network, 2 replicas)
    ├─ Nginx Load Balancer (public network)
    └─ Frontend / Website (public network)
```

---

## Troubleshooting

### `aws configure` fails
- Verify AWS credentials are valid
- Check IAM user has programmatic access enabled

### `aws-setup.ps1` fails on role/user creation
- Resources might already exist; re-running is safe
- Check IAM permissions for the user running the script

### EC2 instance won't start Docker Compose
- Ensure EC2 role `nimbus-ec2-ecr` is attached
- Check ECR repositories exist in the same region
- Verify instance has internet access

### GitHub Actions workflow fails at deploy
- Check all GitHub Secrets are present (Settings → Secrets)
- Verify EC2 Security Group allows SSH from GitHub Actions (use `0.0.0.0/0` or GitHub's IP ranges)
- Ensure EC2 instance is running and the public IP is correct

### Cannot SSH to EC2
- Verify `.pem` key permissions: `chmod 600 key.pem`
- Check Security Group SSH inbound rule
- Ensure you're using the correct username: `ec2-user` (Amazon Linux) or `ubuntu` (Ubuntu)

---

## Cleanup

To remove all AWS resources and stop incurring costs:

```powershell
$AWS_REGION = "eu-central-1"
$AWS_ACCOUNT_ID = "123456789012"

# Terminate EC2
aws ec2 terminate-instances --instance-ids <INSTANCE_ID> --region $AWS_REGION

# Delete ECR repositories
foreach ($name in @("backend", "frontend", "lb")) {
  aws ecr delete-repository --repository-name "nimbus/$name" --force --region $AWS_REGION
}

# Delete IAM access key
aws iam delete-access-key --access-key-id <ACCESS_KEY> --user-name github-actions-nimbus

# Delete IAM user
aws iam delete-user --user-name github-actions-nimbus

# Delete IAM role
aws iam delete-role-policy --role-name nimbus-ec2-ecr --policy-name AmazonEC2ContainerRegistryReadOnly
aws iam delete-role --role-name nimbus-ec2-ecr
```

---

## Documentation

- Full deployment guide: [../docs/aws-deploy.md](../docs/aws-deploy.md)
- Network architecture: [../docs/architecture.md](../docs/architecture.md)
- CI/CD workflow: [../.github/workflows/ci-cd.yml](../.github/workflows/ci-cd.yml)
