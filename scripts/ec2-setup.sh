#!/bin/bash
# ════════════════════════════════════════════════════════════════
# EC2 Instance Setup for Cloud ERP Platform
# ════════════════════════════════════════════════════════════════
# Run this on the EC2 instance after launching it
#
# Prerequisites:
#   - EC2 instance running Amazon Linux 2023 or Ubuntu
#   - IAM role attached (nimbus-ec2-ecr)
#   - SSH access enabled
#
# Usage: bash /home/ec2-user/setup-instance.sh
#        or
#        bash /home/ubuntu/setup-instance.sh
# ════════════════════════════════════════════════════════════════

set -e

echo "🚀 EC2 Instance Setup for Cloud ERP Platform"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
else
  echo "❌ Cannot detect OS"
  exit 1
fi

echo "📍 Detected OS: $OS"
echo ""

# 1. Update system packages
echo "1️⃣  Updating system packages..."
if [ "$OS" = "amzn" ]; then
  sudo dnf update -y >/dev/null 2>&1
elif [ "$OS" = "ubuntu" ]; then
  sudo apt-get update >/dev/null 2>&1
  sudo apt-get upgrade -y >/dev/null 2>&1
fi
echo "✅ System updated"
echo ""

# 2. Install Docker
echo "2️⃣  Installing Docker..."
if [ "$OS" = "amzn" ]; then
  sudo dnf install -y docker >/dev/null 2>&1
elif [ "$OS" = "ubuntu" ]; then
  sudo apt-get install -y docker.io >/dev/null 2>&1
fi
sudo systemctl enable --now docker >/dev/null 2>&1
echo "✅ Docker installed and enabled"
echo ""

# 3. Add current user to docker group
echo "3️⃣  Configuring Docker permissions..."
sudo usermod -aG docker "$USER" >/dev/null 2>&1 || true
echo "✅ User added to docker group (log out/in to apply)"
echo ""

# 4. Install Docker Compose v2
echo "4️⃣  Installing Docker Compose..."
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p "$DOCKER_CONFIG/cli-plugins"
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o "$DOCKER_CONFIG/cli-plugins/docker-compose" 2>/dev/null
chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
echo "✅ Docker Compose installed"
echo ""

# 5. Install AWS CLI v2
echo "5️⃣  Installing AWS CLI v2..."
if [ "$OS" = "amzn" ]; then
  sudo dnf install -y awscli >/dev/null 2>&1 || true
elif [ "$OS" = "ubuntu" ]; then
  sudo apt-get install -y awscli >/dev/null 2>&1 || true
fi
echo "✅ AWS CLI installed"
echo ""

# 6. Verify installations
echo "6️⃣  Verifying installations..."
docker version >/dev/null 2>&1 && echo "✅ Docker: $(docker --version)"
docker compose version >/dev/null 2>&1 && echo "✅ Docker Compose: $(docker compose version)"
aws --version >/dev/null 2>&1 && echo "✅ AWS CLI: $(aws --version)"
echo ""

# 7. Create deployment directory
echo "7️⃣  Creating deployment directory..."
mkdir -p ~/nimbus
cd ~/nimbus
echo "✅ Created ~/nimbus"
echo ""

# 8. Create .env file
echo "8️⃣  Creating .env file..."
if [ -f ~/nimbus/.env ]; then
  echo "⚠️  .env already exists, skipping"
else
  cat > ~/nimbus/.env <<EOF
# Database credentials (set these to strong passwords in production)
POSTGRES_USER=erp
POSTGRES_PASSWORD=change-me-to-a-strong-password
POSTGRES_DB=erp
# JWT signing secret — generated randomly here; the prod stack requires it.
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null || openssl rand -base64 48)
EOF
  echo "✅ Created .env file (with a random JWT_SECRET)"
  echo "   ⚠️  Edit ~/nimbus/.env and set POSTGRES_PASSWORD to a strong password"
fi
echo ""

# 9. Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Instance setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo "  1. Edit ~/nimbus/.env and set POSTGRES_PASSWORD"
echo "  2. Log out and back in so docker group permissions apply"
echo "  3. The GitHub Actions pipeline will SSH here to deploy"
echo ""
echo "Verify everything is ready:"
echo "  $ docker version"
echo "  $ docker compose version"
echo "  $ aws sts get-caller-identity"
echo ""
