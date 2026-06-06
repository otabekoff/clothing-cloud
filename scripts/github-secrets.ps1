# ════════════════════════════════════════════════════════════════
# Add GitHub Secrets for AWS Deployment
# ════════════════════════════════════════════════════════════════
# Prerequisites:
#   - GitHub CLI authenticated: gh auth login
#   - AWS credentials collected from aws-setup.ps1 output
#   - EC2 instance running with public IP
#   - SSH private key (.pem file)
#
# Usage:
#   .\scripts\github-secrets.ps1 `
#     -AccountId "123456789012" `
#     -AccessKeyId "AKIA..." `
#     -SecretAccessKey "wJal..." `
#     -Region "eu-central-1" `
#     -Ec2Host "192.0.2.1" `
#     -Ec2User "ec2-user" `
#     -Ec2KeyPath "C:\path\to\key.pem"
# ════════════════════════════════════════════════════════════════

param(
  [Parameter(Mandatory = $true)]
  [string]$AccountId,

  [Parameter(Mandatory = $true)]
  [string]$AccessKeyId,

  [Parameter(Mandatory = $true)]
  [string]$SecretAccessKey,

  [Parameter(Mandatory = $true)]
  [string]$Region,

  [Parameter(Mandatory = $true)]
  [string]$Ec2Host,

  [Parameter(Mandatory = $true)]
  [string]$Ec2User,

  [Parameter(Mandatory = $true)]
  [string]$Ec2KeyPath
)

$ErrorActionPreference = "Stop"
$repo = "otabekoff/clothing-cloud"

Write-Host "🚀 Adding GitHub Secrets for AWS Deployment`n" -ForegroundColor Green

# Verify gh CLI is authenticated
Write-Host "1️⃣  Verifying GitHub CLI..." -ForegroundColor Cyan
try {
  gh auth status --hostname github.com 2>&1 | Out-Null
  Write-Host "✅ GitHub CLI authenticated`n" -ForegroundColor Green
} catch {
  Write-Host "❌ GitHub CLI not authenticated. Run: gh auth login`n" -ForegroundColor Red
  exit 1
}

# Verify EC2 key exists
if (-not (Test-Path $Ec2KeyPath)) {
  Write-Host "❌ EC2 private key not found: $Ec2KeyPath`n" -ForegroundColor Red
  exit 1
}
Write-Host "✅ EC2 private key found`n" -ForegroundColor Green

# Read EC2 key content
$Ec2KeyContent = Get-Content $Ec2KeyPath -Raw

# Add secrets
Write-Host "2️⃣  Adding secrets to $repo...`n" -ForegroundColor Cyan

$secrets = @{
  "AWS_ACCOUNT_ID"       = $AccountId
  "AWS_ACCESS_KEY_ID"    = $AccessKeyId
  "AWS_SECRET_ACCESS_KEY" = $SecretAccessKey
  "AWS_REGION"           = $Region
  "EC2_HOST"             = $Ec2Host
  "EC2_USER"             = $Ec2User
  "EC2_SSH_KEY"          = $Ec2KeyContent
}

foreach ($key in $secrets.Keys) {
  try {
    $secrets[$key] | gh secret set $key --repo $repo
    Write-Host "✅ Added secret: $key" -ForegroundColor Green
  } catch {
    Write-Host "❌ Failed to add $key : $_" -ForegroundColor Red
    exit 1
  }
}

Write-Host "`n✅ All secrets added successfully!`n" -ForegroundColor Green
Write-Host "📋 Next: Push to main branch to trigger deployment:`n" -ForegroundColor Green
Write-Host "   git push origin main`n" -ForegroundColor Cyan
Write-Host "   Monitor workflow: gh run list --repo otabekoff/clothing-cloud --workflow ci-cd`n" -ForegroundColor Cyan
