# Haraka Mail Server Design

## Overview

Haraka serves as the outbound-only SMTP server for the Mailspark platform. Each user/account brings their own sending domain. The platform auto-generates DKIM key pairs, shows users which DNS records to add, verifies them, and signs outgoing emails with the correct domain's key.

## Architecture

```
Worker → SMTP :587 → Haraka Pipeline → Gmail/Outlook
                      │
                      ├─ tls (built-in)
                      ├─ auth_api (custom)
                      ├─ rate_limit (custom, Redis)
                      ├─ add_tracking (custom)
                      ├─ custom_dkim_sign (custom, replaces built-in)
                      ├─ delivery_webhook (custom)
                      └─ bounce_webhook (custom)
```

## Key Decisions

- **Outbound only** — Haraka does not receive inbound email
- **Multi-domain DKIM** — Each user domain has its own DKIM key pair stored in DB, fetched via API/Redis cache
- **TLS** — Built-in plugin with self-signed cert for dev, real cert for production
- **6 custom plugins + 1 built-in (tls)** — Custom DKIM replaces built-in to support multi-domain

## Plugin Load Order & Purpose

1. **tls** (built-in) — Encrypts SMTP connections
2. **auth_api** (custom) — Validates SMTP credentials against env vars
3. **rate_limit** (custom) — Per-account hourly limits via Redis sliding window
4. **add_tracking** (custom) — Reads/strips internal headers, stores IDs in txn.notes
5. **custom_dkim_sign** (custom) — Looks up DKIM private key by sender domain from API, signs email
6. **delivery_webhook** (custom) — POSTs delivery events to API (fire-and-forget)
7. **bounce_webhook** (custom) — POSTs bounce events to API, classifies hard vs soft

## New Database Table

```
sending_domains
├── id               UUID PK
├── account_id       FK → accounts
├── domain           varchar(255) — "nike.com"
├── status           enum(pending, verified, failed)
├── dkim_selector    varchar(50) — "default"
├── dkim_private_key text (encrypted)
├── dkim_public_key  text
├── spf_verified     boolean
├── dkim_verified    boolean
├── dmarc_verified   boolean
├── verified_at      timestamp
├── created_at       timestamp
├── updated_at       timestamp
```

## File Structure

```
infrastructure/haraka/
├── Dockerfile
├── generate-dkim.sh (dev utility)
├── config/
│   ├── smtp.ini
│   ├── plugins
│   ├── tls.ini (NEW)
│   ├── outbound.ini
│   └── loglevel (NEW)
├── plugins/
│   ├── auth_api.js
│   ├── rate_limit.js
│   ├── add_tracking.js
│   ├── custom_dkim_sign.js (NEW, replaces dkim_sign)
│   ├── delivery_webhook.js
│   └── bounce_webhook.js
├── tls/ (gitignored)
│   ├── tls_key.pem
│   └── tls_cert.pem
└── dkim/ (gitignored, dev fallback only)
```

## Domain Verification Flow

1. User adds domain in dashboard → API generates DKIM key pair → stores in DB
2. API returns DNS records user must add (SPF, DKIM TXT, DMARC)
3. User adds records to their DNS provider
4. User clicks "Verify" → API checks DNS → marks domain as verified
5. When sending, custom_dkim_sign plugin fetches the domain's private key and signs
