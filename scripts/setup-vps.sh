#!/bin/bash
set -euo pipefail

#############################################################################
# VPS Setup Script for Mailspark Email Platform
#
# Run this on a fresh Ubuntu 22.04/24.04 DigitalOcean droplet:
#   ssh root@167.71.225.121
#   bash setup-vps.sh
#
# What this does:
#   1. Updates the system
#   2. Installs Docker + Docker Compose
#   3. Sets hostname to mail.mailspark.online
#   4. Opens firewall ports (25, 587, 80, 443)
#   5. Starts the infrastructure (Postgres, Redis, Haraka)
#############################################################################

DOMAIN="mailspark.online"
HOSTNAME="mail.${DOMAIN}"

echo "=== Mailspark VPS Setup ==="
echo "Domain:   ${DOMAIN}"
echo "Hostname: ${HOSTNAME}"
echo ""

# ── Step 1: Set hostname ────────────────────────────────────
echo "1. Setting hostname to ${HOSTNAME}..."
hostnamectl set-hostname "${HOSTNAME}"
echo "127.0.0.1 ${HOSTNAME}" >> /etc/hosts
echo "   Done."

# ── Step 2: System update ───────────────────────────────────
echo "2. Updating system packages..."
apt update -qq && apt upgrade -y -qq
echo "   Done."

# ── Step 3: Install Docker ──────────────────────────────────
echo "3. Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "   Docker installed."
else
    echo "   Docker already installed."
fi

# Install Docker Compose plugin if needed
if ! docker compose version &> /dev/null; then
    apt install -y -qq docker-compose-plugin
    echo "   Docker Compose plugin installed."
else
    echo "   Docker Compose already available."
fi

# ── Step 4: Firewall setup ──────────────────────────────────
echo "4. Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp   # SSH
    ufw allow 25/tcp   # SMTP
    ufw allow 587/tcp  # SMTP submission
    ufw allow 80/tcp   # HTTP (for Let's Encrypt)
    ufw allow 443/tcp  # HTTPS
    ufw allow 3000/tcp # API server
    ufw --force enable
    echo "   Firewall configured."
else
    echo "   UFW not found, skipping firewall setup."
fi

# ── Step 5: Create project directory ────────────────────────
echo "5. Setting up project directory..."
PROJECT_DIR="/opt/email-platform"
mkdir -p "${PROJECT_DIR}"
echo "   Project directory: ${PROJECT_DIR}"

echo ""
echo "=== VPS Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Copy your project files to ${PROJECT_DIR}/"
echo "  2. Copy .env.production to ${PROJECT_DIR}/.env"
echo "  3. Run: cd ${PROJECT_DIR} && docker compose up -d"
echo "  4. Test: node scripts/test-haraka.js arman.iit4080@gmail.com"
