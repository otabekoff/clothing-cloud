# ════════════════════════════════════════════════════════════════
# AWS One-Time Setup for Cloud ERP Platform
# ════════════════════════════════════════════════════════════════
# Prerequisites:
#   - AWS CLI installed and authenticated: aws configure
#   - Region set (e.g., eu-central-1)
#   - IAM permissions to create ECR, IAM users/roles, EC2 resources
#
# Usage: .\scripts\aws-setup.ps1
# ════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

Write-Host "🚀 Cloud ERP Platform - AWS Setup`n" -ForegroundColor Green

# 1. Verify AWS CLI is configured
Write-Host "1️⃣  Verifying AWS credentials..." -ForegroundColor Cyan
try {
  $identity = aws sts get-caller-identity --query 'Account' --output text
  Write-Host "✅ AWS Account ID: $identity`n" -ForegroundColor Green
} catch {
  Write-Host "❌ AWS CLI not configured. Run: aws configure`n" -ForegroundColor Red
  exit 1
}

$AWS_ACCOUNT_ID = $identity
$AWS_REGION = aws configure get region
if (-not $AWS_REGION) { $AWS_REGION = "eu-central-1" }

Write-Host "📍 Using region: $AWS_REGION`n" -ForegroundColor Yellow

# 2. Create ECR repositories
Write-Host "2️⃣  Creating ECR repositories..." -ForegroundColor Cyan
$repo_names = @("backend", "frontend", "lb")
foreach ($name in $repo_names) {
  $repo = "nimbus/$name"
  try {
    aws ecr create-repository `
      --repository-name $repo `
      --region $AWS_REGION `
      --image-scanning-configuration scanOnPush=true | Out-Null
    Write-Host "✅ Created ECR repo: $repo" -ForegroundColor Green
  } catch {
    if ($_ -match "RepositoryAlreadyExistsException") {
      Write-Host "⚠️  ECR repo already exists: $repo" -ForegroundColor Yellow
    } else {
      Write-Host "❌ Failed to create $repo : $_" -ForegroundColor Red
      exit 1
    }
  }
}
Write-Host ""

# 3. Create IAM user for GitHub Actions
Write-Host "3️⃣  Creating IAM user for GitHub Actions..." -ForegroundColor Cyan
$iam_user = "github-actions-nimbus"
try {
  aws iam create-user --user-name $iam_user | Out-Null
  Write-Host "✅ Created IAM user: $iam_user" -ForegroundColor Green
} catch {
  if ($_ -match "EntityAlreadyExistsException") {
    Write-Host "⚠️  IAM user already exists: $iam_user" -ForegroundColor Yellow
  } else {
    Write-Host "❌ Failed to create IAM user: $_" -ForegroundColor Red
    exit 1
  }
}

# 4. Attach ECR push policy to the user
Write-Host "4️⃣  Attaching ECR push policy..." -ForegroundColor Cyan
$policy = @"
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
"@

$policy_file = "$env:TEMP\ecr-policy.json"
$policy | Set-Content $policy_file

try {
  aws iam put-user-policy `
    --user-name $iam_user `
    --policy-name "ecr-push-nimbus" `
    --policy-document file://$policy_file | Out-Null
  Write-Host "✅ Attached ECR push policy to $iam_user" -ForegroundColor Green
} catch {
  Write-Host "❌ Failed to attach policy: $_" -ForegroundColor Red
  exit 1
}
Remove-Item $policy_file -Force
Write-Host ""

# 5. Create IAM role for EC2
Write-Host "5️⃣  Creating IAM role for EC2..." -ForegroundColor Cyan
$role_name = "nimbus-ec2-ecr"
$trust_policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
"@

$trust_file = "$env:TEMP\ec2-trust.json"
$trust_policy | Set-Content $trust_file

try {
  aws iam create-role `
    --role-name $role_name `
    --assume-role-policy-document file://$trust_file | Out-Null
  Write-Host "✅ Created IAM role: $role_name" -ForegroundColor Green
} catch {
  if ($_ -match "EntityAlreadyExistsException") {
    Write-Host "⚠️  IAM role already exists: $role_name" -ForegroundColor Yellow
  } else {
    Write-Host "❌ Failed to create role: $_" -ForegroundColor Red
    exit 1
  }
}
Remove-Item $trust_file -Force

# 6. Attach ECR read policy to the role
Write-Host "6️⃣  Attaching ECR read policy to EC2 role..." -ForegroundColor Cyan
try {
  aws iam attach-role-policy `
    --role-name $role_name `
    --policy-arn "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly" | Out-Null
  Write-Host "✅ Attached AmazonEC2ContainerRegistryReadOnly to $role_name" -ForegroundColor Green
} catch {
  Write-Host "❌ Failed to attach policy: $_" -ForegroundColor Red
  exit 1
}
Write-Host ""

# 7. Generate access key for GitHub Actions
Write-Host "7️⃣  Generating access key for GitHub Actions..." -ForegroundColor Cyan
Write-Host "⚠️  IMPORTANT: Save these credentials securely!" -ForegroundColor Yellow
Write-Host "    Add them to GitHub Secrets (repo settings):`n" -ForegroundColor Yellow

$access_key = aws iam create-access-key --user-name $iam_user --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text | ForEach-Object { $_ -split '\s+' }
Write-Host "    AWS_ACCESS_KEY_ID: $($access_key[0])" -ForegroundColor Cyan
Write-Host "    AWS_SECRET_ACCESS_KEY: $($access_key[1])`n" -ForegroundColor Cyan

# 8. Display summary
Write-Host "8️⃣  Setup Summary" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"
Write-Host "AWS_REGION: $AWS_REGION"
Write-Host "ECR_REGISTRY: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
Write-Host "IAM User: $iam_user"
Write-Host "EC2 Role: $role_name"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "✅ AWS resources created successfully!`n" -ForegroundColor Green
Write-Host "📋 Next steps:`n" -ForegroundColor Green
Write-Host "  1. Add the credentials to GitHub repo secrets (Settings → Secrets and variables → Actions):`n"
Write-Host "     • AWS_ACCESS_KEY_ID"
Write-Host "     • AWS_SECRET_ACCESS_KEY"
Write-Host "     • AWS_REGION: $AWS_REGION"
Write-Host "     • AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID`n"
Write-Host "  2. Launch EC2 instance with:"
Write-Host "     • t3.small instance type"
Write-Host "     • IAM role: $role_name"
Write-Host "     • Security group: SSH (your IP), HTTP (0.0.0.0/0), port 8080 (your IP)`n"
Write-Host "  3. Configure EC2 with: .\scripts\ec2-setup.sh (or run manually)`n"
Write-Host "  4. Add EC2 secrets to GitHub:`n"
Write-Host "     • EC2_HOST (public IP or DNS)"
Write-Host "     • EC2_USER (ec2-user or ubuntu)"
Write-Host "     • EC2_SSH_KEY (private SSH key PEM content)`n"
