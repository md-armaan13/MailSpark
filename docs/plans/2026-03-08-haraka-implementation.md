# Haraka Mail Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready outbound-only Haraka SMTP server with TLS, multi-domain DKIM signing, rate limiting, tracking headers, and delivery/bounce webhooks.

**Architecture:** Haraka runs as a Docker container, listens on ports 25/587. Email workers connect via SMTP, authenticate, and send emails. 6 custom plugins + 1 built-in (tls) process each email. DKIM keys are per-user-domain, stored in PostgreSQL, cached in Redis, and fetched by the custom_dkim_sign plugin via our API.

**Tech Stack:** Haraka 3.x (Node.js SMTP), Redis 4 (rate limiting + DKIM cache), Node 20 built-in fetch (webhooks), Drizzle ORM (sending_domains table), OpenSSL (TLS/DKIM key generation).

---

### Task 1: Add TLS Config + Generate Script

**What this does:** TLS encrypts the SMTP connection so credentials aren't sent in plain text. The built-in `tls` plugin reads a cert/key from config.

**Files:**
- Create: `infrastructure/haraka/config/tls.ini`
- Create: `infrastructure/haraka/generate-tls.sh`
- Modify: `infrastructure/haraka/Dockerfile`
- Modify: `.gitignore` — add `infrastructure/haraka/tls/`

**Step 1: Create TLS config**

File: `infrastructure/haraka/config/tls.ini`
```ini
key=tls/tls_key.pem
cert=tls/tls_cert.pem
```

**Step 2: Create TLS generation script**

File: `infrastructure/haraka/generate-tls.sh`
```bash
#!/bin/bash
set -euo pipefail

TLS_DIR="$(dirname "$0")/tls"
mkdir -p "$TLS_DIR"

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "${TLS_DIR}/tls_key.pem" \
  -out "${TLS_DIR}/tls_cert.pem" \
  -subj "/CN=mail.localhost"

echo "TLS cert generated at: ${TLS_DIR}/"
echo "For production, replace with a real certificate."
```
Make executable: `chmod +x infrastructure/haraka/generate-tls.sh`

**Step 3: Update Dockerfile to generate TLS cert during build**

Replace the current Dockerfile with:
```dockerfile
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Install Haraka globally
RUN npm install -g Haraka

# Initialize Haraka directory
RUN haraka -i /app/haraka

# Install plugin dependencies
WORKDIR /app/haraka
RUN npm install redis@4

# Generate self-signed TLS cert for development
RUN mkdir -p config/tls && \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout config/tls/tls_key.pem -out config/tls/tls_cert.pem \
    -subj "/CN=mail.localhost"

# Copy config and plugins (also mounted as volumes in dev)
COPY config/ /app/haraka/config/
COPY plugins/ /app/haraka/plugins/

EXPOSE 25 587

CMD ["haraka", "-c", "/app/haraka"]
```

**Step 4: Add tls/ to .gitignore**

Append to `.gitignore`:
```
infrastructure/haraka/tls/
```

**Step 5: Run generate-tls.sh locally**

```bash
cd infrastructure/haraka && ./generate-tls.sh
```
Expected: `TLS cert generated at: ./tls/`

**Step 6: Commit**

```bash
git add infrastructure/haraka/config/tls.ini infrastructure/haraka/generate-tls.sh infrastructure/haraka/Dockerfile .gitignore
git commit -m "feat(haraka): add TLS config and cert generation"
```

---

### Task 2: Update Plugin Load Order

**What this does:** Updates the `config/plugins` file to add `tls` (built-in) and replace `dkim_sign` with our custom `custom_dkim_sign`.

**Files:**
- Modify: `infrastructure/haraka/config/plugins`
- Create: `infrastructure/haraka/config/loglevel`
- Delete: `infrastructure/haraka/config/dkim_sign.ini` (no longer used — custom plugin replaces it)

**Step 1: Rewrite the plugins file**

File: `infrastructure/haraka/config/plugins`
```
# TLS encryption (built-in)
tls

# SMTP authentication (custom)
auth_api

# Per-account rate limiting via Redis (custom)
rate_limit

# Tracking header injection/stripping (custom)
add_tracking

# Multi-domain DKIM signing (custom — replaces built-in dkim_sign)
custom_dkim_sign

# Delivery status notifications (custom)
delivery_webhook

# Bounce handling (custom)
bounce_webhook
```

**Step 2: Create loglevel config**

File: `infrastructure/haraka/config/loglevel`
```
info
```

**Step 3: Delete dkim_sign.ini**

```bash
rm infrastructure/haraka/config/dkim_sign.ini
```

**Step 4: Commit**

```bash
git add infrastructure/haraka/config/plugins infrastructure/haraka/config/loglevel
git rm infrastructure/haraka/config/dkim_sign.ini
git commit -m "feat(haraka): update plugin order — add tls, replace dkim_sign with custom"
```

---

### Task 3: Add `sending_domains` Database Table

**What this does:** Creates the table that stores per-user-domain DKIM keys. The custom_dkim_sign plugin will query this (via API) to sign emails with the correct domain's key.

**Files:**
- Create: `packages/database/src/schema/sending-domains.ts`
- Modify: `packages/database/src/schema/index.ts`

**Step 1: Create the schema file**

File: `packages/database/src/schema/sending-domains.ts`
```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

export const domainStatusEnum = pgEnum('domain_status', ['pending', 'verified', 'failed']);

export const sendingDomains = pgTable('sending_domains', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  domain: varchar('domain', { length: 255 }).notNull(),
  status: domainStatusEnum('status').notNull().default('pending'),
  dkimSelector: varchar('dkim_selector', { length: 50 }).notNull().default('default'),
  dkimPrivateKey: text('dkim_private_key').notNull(),
  dkimPublicKey: text('dkim_public_key').notNull(),
  spfVerified: boolean('spf_verified').notNull().default(false),
  dkimVerified: boolean('dkim_verified').notNull().default(false),
  dmarcVerified: boolean('dmarc_verified').notNull().default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountDomainIdx: index('sending_domains_account_domain_idx').on(table.accountId, table.domain),
  domainIdx: index('sending_domains_domain_idx').on(table.domain),
}));
```

**Step 2: Add export to barrel file**

Add to `packages/database/src/schema/index.ts`:
```typescript
export { sendingDomains, domainStatusEnum } from './sending-domains.js';
```

**Step 3: Build to verify**

```bash
pnpm build
```
Expected: All 3 packages build successfully.

**Step 4: Commit**

```bash
git add packages/database/src/schema/sending-domains.ts packages/database/src/schema/index.ts
git commit -m "feat(db): add sending_domains table for multi-domain DKIM"
```

---

### Task 4: Add DKIM Lookup API Endpoint

**What this does:** The custom_dkim_sign Haraka plugin needs to fetch the DKIM private key for a given sender domain. This endpoint provides that. It also caches the result in Redis for performance.

**Files:**
- Create: `apps/api/src/routes/domains/dkim-lookup.ts`
- Modify: `apps/api/src/server.ts` — register the new route

**Step 1: Create the DKIM lookup route**

File: `apps/api/src/routes/domains/dkim-lookup.ts`
```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@email-platform/database';
import { sendingDomains } from '@email-platform/database/schema';
import { eq, and } from 'drizzle-orm';

const querySchema = z.object({
  domain: z.string().min(1),
});

export async function dkimLookupRoutes(fastify: FastifyInstance) {
  // Internal endpoint — called by Haraka custom_dkim_sign plugin
  // No auth required (only accessible within Docker network)
  fastify.get('/internal/dkim-lookup', async (request, reply) => {
    const result = querySchema.safeParse(request.query);
    if (!result.success) {
      return reply.status(400).send({ success: false, error: 'Missing domain parameter' });
    }

    const { domain } = result.data;

    const record = await db.query.sendingDomains.findFirst({
      where: and(
        eq(sendingDomains.domain, domain),
        eq(sendingDomains.status, 'verified'),
      ),
      columns: {
        dkimSelector: true,
        dkimPrivateKey: true,
        domain: true,
      },
    });

    if (!record) {
      return reply.status(404).send({ success: false, error: 'Domain not found or not verified' });
    }

    return reply.send({
      success: true,
      data: {
        domain: record.domain,
        selector: record.dkimSelector,
        privateKey: record.dkimPrivateKey,
      },
    });
  });
}
```

**Step 2: Register the route in server.ts**

Add import and registration to `apps/api/src/server.ts`:
```typescript
import { dkimLookupRoutes } from './routes/domains/dkim-lookup.js';
```
And inside `buildApp()`:
```typescript
await app.register(dkimLookupRoutes);
```

**Step 3: Build to verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add apps/api/src/routes/domains/dkim-lookup.ts apps/api/src/server.ts
git commit -m "feat(api): add internal DKIM lookup endpoint for Haraka"
```

---

### Task 5: Create `custom_dkim_sign` Plugin

**What this does:** Replaces the built-in `dkim_sign` plugin. Reads the sender domain from the `From:` header, fetches the DKIM private key from our API (with Redis caching), and signs the email.

**Files:**
- Create: `infrastructure/haraka/plugins/custom_dkim_sign.js`

**Step 1: Write the plugin**

File: `infrastructure/haraka/plugins/custom_dkim_sign.js`
```javascript
'use strict';

const { createClient } = require('redis');
const crypto = require('crypto');

const API_URL = process.env.WEBHOOK_URL
  ? process.env.WEBHOOK_URL.replace('/webhooks/haraka', '')
  : 'http://api:3000';

const CACHE_TTL = 300; // 5 minutes

let redisClient = null;

exports.register = function () {
  this.loginfo('custom_dkim_sign plugin registered');
};

exports.hook_init_master = async function (next) {
  await connectRedis(this);
  next();
};

exports.hook_init_child = async function (next) {
  await connectRedis(this);
  next();
};

async function connectRedis(plugin) {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => plugin.logerror(`DKIM Redis error: ${err.message}`));
    await redisClient.connect();
    plugin.logdebug('custom_dkim_sign: Redis connected');
  } catch (err) {
    plugin.logerror(`custom_dkim_sign: Redis connect failed: ${err.message}`);
  }
}

exports.hook_data_post = async function (next, connection) {
  const txn = connection.transaction;
  if (!txn) return next();

  // Extract sender domain from "From:" header
  const fromHeader = txn.header.get('From');
  if (!fromHeader) {
    this.logwarn('custom_dkim_sign: No From header, skipping DKIM');
    return next();
  }

  const domainMatch = fromHeader.match(/@([a-zA-Z0-9.-]+)/);
  if (!domainMatch) {
    this.logwarn(`custom_dkim_sign: Could not extract domain from: ${fromHeader}`);
    return next();
  }

  const domain = domainMatch[1].toLowerCase().trim();

  try {
    // Try Redis cache first
    const dkimData = await getDkimData(domain, this);

    if (!dkimData) {
      this.logwarn(`custom_dkim_sign: No DKIM key found for domain: ${domain}`);
      return next();
    }

    // Sign the email
    const headersToSign = ['from', 'to', 'subject', 'date', 'message-id'];
    const signature = createDkimSignature(txn, dkimData, headersToSign);

    if (signature) {
      txn.header.add_end('DKIM-Signature', signature);
      this.loginfo(`custom_dkim_sign: Signed email for domain: ${domain}`);
    }
  } catch (err) {
    this.logerror(`custom_dkim_sign error: ${err.message}`);
  }

  next();
};

async function getDkimData(domain, plugin) {
  const cacheKey = `dkim:${domain}`;

  // Check Redis cache
  if (redisClient && redisClient.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        plugin.logdebug(`custom_dkim_sign: Cache hit for ${domain}`);
        return JSON.parse(cached);
      }
    } catch (err) {
      plugin.logwarn(`custom_dkim_sign: Cache read error: ${err.message}`);
    }
  }

  // Fetch from API
  try {
    const response = await fetch(
      `${API_URL}/internal/dkim-lookup?domain=${encodeURIComponent(domain)}`,
      { signal: AbortSignal.timeout(3000) },
    );

    if (!response.ok) {
      plugin.logdebug(`custom_dkim_sign: API returned ${response.status} for ${domain}`);
      return null;
    }

    const body = await response.json();
    if (!body.success || !body.data) return null;

    const dkimData = body.data;

    // Cache in Redis
    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(dkimData));
      } catch (err) {
        plugin.logwarn(`custom_dkim_sign: Cache write error: ${err.message}`);
      }
    }

    return dkimData;
  } catch (err) {
    plugin.logerror(`custom_dkim_sign: API fetch error: ${err.message}`);
    return null;
  }
}

function createDkimSignature(txn, dkimData, headersToSign) {
  const { domain, selector, privateKey } = dkimData;

  // Canonicalize headers (relaxed)
  const headerLines = [];
  for (const name of headersToSign) {
    const value = txn.header.get(name);
    if (value) {
      headerLines.push(`${name.toLowerCase()}:${value.trim()}`);
    }
  }

  // Build DKIM-Signature header (without b= value)
  const timestamp = Math.floor(Date.now() / 1000);
  const dkimHeader =
    `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${domain}; s=${selector}; ` +
    `t=${timestamp}; ` +
    `h=${headersToSign.join(':')}; ` +
    `bh=${bodyHash(txn)}; ` +
    `b=`;

  // Add the DKIM-Signature header itself to the signing input
  headerLines.push(`dkim-signature:${dkimHeader}`);

  const signingInput = headerLines.join('\r\n');

  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = signer.sign(privateKey, 'base64');
    return `${dkimHeader}${signature}`;
  } catch (err) {
    return null;
  }
}

function bodyHash(txn) {
  const body = txn.body ? txn.body.toString() : '';
  // Relaxed body canonicalization: trim trailing whitespace, ensure CRLF, single trailing CRLF
  const canonicalized = body
    .replace(/[ \t]+\r?\n/g, '\r\n')
    .replace(/\r?\n/g, '\r\n')
    .replace(/(\r\n)+$/, '\r\n');
  return crypto.createHash('sha256').update(canonicalized).digest('base64');
}
```

**Step 2: Commit**

```bash
git add infrastructure/haraka/plugins/custom_dkim_sign.js
git commit -m "feat(haraka): add custom_dkim_sign plugin for multi-domain DKIM"
```

---

### Task 6: Update docker-compose.yml

**What this does:** Adds TLS volume mount so dev TLS certs are available inside the container.

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add TLS volume**

Add this line under the haraka `volumes:` section:
```yaml
      - ./infrastructure/haraka/tls:/app/haraka/config/tls
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(haraka): add TLS volume mount to docker-compose"
```

---

### Task 7: Remove `host_list.ini` + Clean Up

**What this does:** `host_list.ini` is for inbound email (tells Haraka which domains to accept mail for). We are outbound-only, so this file is unnecessary and could cause confusion.

**Files:**
- Delete: `infrastructure/haraka/config/host_list.ini`

**Step 1: Delete the file**

```bash
rm infrastructure/haraka/config/host_list.ini
```

**Step 2: Commit**

```bash
git rm infrastructure/haraka/config/host_list.ini
git commit -m "chore(haraka): remove host_list.ini (outbound-only server)"
```

---

### Task 8: Build & Smoke Test

**What this does:** Verify the entire Haraka setup builds and starts without errors.

**Step 1: Build all packages**

```bash
pnpm build
```
Expected: 3 packages build successfully.

**Step 2: Start infrastructure**

```bash
docker-compose up -d postgres redis
```
Expected: Both containers running.

**Step 3: Build Haraka image**

```bash
docker-compose build haraka
```
Expected: Image builds successfully, TLS cert generated during build.

**Step 4: Start Haraka**

```bash
docker-compose up -d haraka
```

**Step 5: Check Haraka logs**

```bash
docker-compose logs haraka
```
Expected output should show:
- `tls plugin registered`
- `auth_api plugin registered`
- `rate_limit plugin registered`
- `add_tracking plugin registered`
- `custom_dkim_sign plugin registered`
- `delivery_webhook plugin registered`
- `bounce_webhook plugin registered`
- `Listening on [::0]:25` and `[::0]:587`

**Step 6: Commit (if any fixes were needed)**

```bash
git add -A && git commit -m "fix(haraka): smoke test fixes"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | TLS config + cert generation | 4 files |
| 2 | Plugin load order (add tls, swap dkim_sign → custom) | 3 files |
| 3 | `sending_domains` DB table for multi-domain DKIM | 2 files |
| 4 | Internal DKIM lookup API endpoint | 2 files |
| 5 | `custom_dkim_sign` plugin (fetches key from API, caches in Redis) | 1 file |
| 6 | docker-compose TLS volume | 1 file |
| 7 | Remove `host_list.ini` (outbound-only) | 1 file |
| 8 | Build & smoke test | 0 files (verification) |
