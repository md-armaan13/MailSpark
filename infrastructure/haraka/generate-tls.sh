#!/bin/bash
set -euo pipefail

TLS_DIR="$(dirname "$0")/tls"
mkdir -p "$TLS_DIR"

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "${TLS_DIR}/tls_key.pem" \
  -out "${TLS_DIR}/tls_cert.pem" \
  -subj "/CN=mail.localhost"

echo ""
echo "TLS certificate generated at: ${TLS_DIR}/"
echo "For production, replace with a real certificate from Let's Encrypt."
