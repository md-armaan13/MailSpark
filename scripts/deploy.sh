#!/bin/bash
set -euo pipefail

#############################################################################
# Deploy Mailspark to VPS
#
# Run from your Mac:
#   bash scripts/deploy.sh
#
# This script:
#   1. Syncs project files to VPS via rsync
#   2. Copies .env.production as .env
#   3. Builds and starts Docker containers on VPS
#############################################################################

VPS_IP="167.71.225.121"
VPS_USER="root"
REMOTE_DIR="/opt/email-platform"

echo "=== Deploying Mailspark to ${VPS_IP} ==="

# ── Step 1: Sync files to VPS ───────────────────────────────
echo "1. Syncing project files..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.turbo' \
    --exclude '.next' \
    --exclude 'postgres_data' \
    --exclude 'redis_data' \
    --exclude 'minio_data' \
    --exclude '.git' \
    --exclude '.env' \
    ./ "${VPS_USER}@${VPS_IP}:${REMOTE_DIR}/"

echo "   Files synced."

# ── Step 2: Copy production env ─────────────────────────────
echo "2. Copying .env.production as .env..."
scp .env.production "${VPS_USER}@${VPS_IP}:${REMOTE_DIR}/.env"
echo "   Done."

# ── Step 3: Build and start containers ──────────────────────
echo "3. Building and starting containers on VPS..."
ssh "${VPS_USER}@${VPS_IP}" << 'REMOTE_SCRIPT'
    cd /opt/email-platform

    # Build and start
    docker compose build haraka
    docker compose up -d redis haraka

    echo ""
    echo "=== Container Status ==="
    docker compose ps

    # Wait for Haraka to start
    sleep 5
    echo ""
    echo "=== Haraka Logs ==="
    docker compose logs --tail 15 haraka
REMOTE_SCRIPT

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next: SSH in and test:"
echo "  ssh root@${VPS_IP}"
echo "  cd ${REMOTE_DIR}"
echo "  node scripts/test-haraka.js arman.iit4080@gmail.com"
