#!/bin/bash
set -euo pipefail

DOMAIN="${1:-yourdomain.com}"
SELECTOR="${2:-default}"
DKIM_DIR="$(dirname "$0")/dkim/${DOMAIN}"

mkdir -p "$DKIM_DIR"

# Generate 2048-bit RSA key pair
openssl genrsa -out "${DKIM_DIR}/${SELECTOR}.pem" 2048

echo ""
echo "=== DKIM DNS Record ==="
echo "Add the following TXT record to your DNS:"
echo ""
echo "Name: ${SELECTOR}._domainkey.${DOMAIN}"
echo "Value:"
openssl rsa -in "${DKIM_DIR}/${SELECTOR}.pem" -pubout -outform PEM 2>/dev/null | \
  grep -v '^-----' | tr -d '\n'
echo ""
echo ""
echo "Key saved to: ${DKIM_DIR}/${SELECTOR}.pem"
