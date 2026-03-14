'use strict';

const { createClient } = require('redis');
const crypto = require('crypto');
const http = require('node:http');
const https = require('node:https');

// API base URL — derived from WEBHOOK_URL or defaults to http://api:3000
const API_URL = process.env.WEBHOOK_URL
  ? process.env.WEBHOOK_URL.replace('/webhooks/haraka', '')
  : 'http://api:3000';

// How long to cache a domain's DKIM key in Redis (seconds)
const CACHE_TTL = 300; // 5 minutes

let redisClient = null;

// ─── LIFECYCLE HOOKS ─────────────────────────────────────────────
// Haraka forks multiple worker processes. Each needs its own Redis connection.

exports.register = function () {
  this.loginfo('custom_dkim_sign plugin registered');
};

// Called once in the master process
exports.hook_init_master = async function (next) {
  await connectRedis(this);
  next();
};

// Called once per forked child process
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

// ─── MAIN HOOK ───────────────────────────────────────────────────
// hook_data_post fires AFTER the email body is received but BEFORE sending.
// This is where we sign the email.

exports.hook_data_post = async function (next, connection) {
  const txn = connection.transaction;
  if (!txn) return next();

  // ── Step 1: Extract sender domain from "From:" header ──
  //
  // Example: "From: John <newsletter@nike.com>"
  // We extract: "nike.com"
  //
  const fromHeader = txn.header.get('From');
  if (!fromHeader) {
    this.logwarn('custom_dkim_sign: No From header, skipping');
    return next();
  }

  const domainMatch = fromHeader.match(/@([a-zA-Z0-9.-]+)/);
  if (!domainMatch) {
    this.logwarn(`custom_dkim_sign: Could not extract domain from: ${fromHeader}`);
    return next();
  }

  const domain = domainMatch[1].toLowerCase().trim();

  // ── Step 2: Get DKIM key (cache → API fallback) ──
  //
  // First checks Redis: "dkim:nike.com" → cached key data
  // If not cached, calls: GET http://api:3000/internal/dkim-lookup?domain=nike.com
  // Caches the result for 5 minutes
  //
  try {
    const dkimData = await getDkimData(domain, this);

    if (!dkimData) {
      this.logwarn(`custom_dkim_sign: No DKIM key for domain: ${domain}, sending unsigned`);
      return next();
    }

    // ── Step 3: Sign the email ──
    //
    // Creates a DKIM-Signature header that looks like:
    //   DKIM-Signature: v=1; a=rsa-sha256; d=nike.com; s=default; ...
    //
    // Gmail/Outlook will:
    //   1. Read this header
    //   2. Look up default._domainkey.nike.com in DNS → get public key
    //   3. Verify the signature matches → email is legit
    //
    const headersToSign = ['from', 'to', 'subject', 'date', 'message-id'];
    const signature = createDkimSignature(txn, dkimData, headersToSign);

    if (signature) {
      txn.header.add_end('DKIM-Signature', signature);
      this.loginfo(`custom_dkim_sign: Signed email for domain: ${domain}`);
    } else {
      this.logwarn(`custom_dkim_sign: Signing failed for domain: ${domain}`);
    }
  } catch (err) {
    // Don't block email delivery if signing fails — send unsigned
    this.logerror(`custom_dkim_sign error: ${err.message}`);
  }

  next();
};

// ─── DKIM KEY LOOKUP (Cache → API) ──────────────────────────────

async function getDkimData(domain, plugin) {
  const cacheKey = `dkim:${domain}`;

  // Try Redis cache first (fast path, ~1ms)
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

  // Cache miss — fetch from API (slower path, ~10-50ms)
  try {
    const dkimData = await fetchDkimFromApi(domain, plugin);
    if (!dkimData) return null;

    // Store in Redis cache for next time
    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(dkimData));
        plugin.logdebug(`custom_dkim_sign: Cached DKIM key for ${domain}`);
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

// ─── API FETCH (Node.js built-in http, no global fetch) ──────────

function fetchDkimFromApi(domain, plugin) {
  return new Promise((resolve) => {
    const reqUrl = `${API_URL}/internal/dkim-lookup?domain=${encodeURIComponent(domain)}`;
    const isHttps = reqUrl.startsWith('https:');
    const transport = isHttps ? https : http;

    const req = transport.get(reqUrl, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          plugin.logdebug(`custom_dkim_sign: API returned ${res.statusCode} for ${domain}`);
          return resolve(null);
        }
        try {
          const body = JSON.parse(data);
          resolve(body.success && body.data ? body.data : null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      plugin.logerror(`custom_dkim_sign: API request error: ${err.message}`);
      resolve(null);
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ─── DKIM SIGNATURE CREATION ─────────────────────────────────────
//
// DKIM works like this:
//   1. Hash the email body → "bh" (body hash)
//   2. Concatenate selected headers + the DKIM-Signature header (without b= value)
//   3. Sign that with the private key → "b" (signature)
//   4. Put it all together as the DKIM-Signature header
//
// Gmail then reverses this:
//   1. Get public key from DNS
//   2. Verify the signature matches the headers + body hash
//   3. If match → email passes DKIM ✓

function createDkimSignature(txn, dkimData, headersToSign) {
  const { domain, selector, privateKey } = dkimData;

  // Collect the headers we're signing (relaxed canonicalization)
  // "relaxed" means: lowercase header names, trim whitespace
  const headerLines = [];
  for (const name of headersToSign) {
    const value = txn.header.get(name);
    if (value) {
      headerLines.push(`${name.toLowerCase()}:${value.trim()}`);
    }
  }

  // Create the body hash (SHA-256 of the canonicalized body)
  const bh = computeBodyHash(txn);

  // Build the DKIM-Signature value (without the actual signature "b=" yet)
  const timestamp = Math.floor(Date.now() / 1000);
  const dkimHeader =
    `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${domain}; s=${selector}; ` +
    `t=${timestamp}; ` +
    `h=${headersToSign.join(':')}; ` +
    `bh=${bh}; ` +
    `b=`;

  // The DKIM spec says: also include the DKIM-Signature header itself
  // (with empty b=) in the data we sign
  headerLines.push(`dkim-signature:${dkimHeader}`);

  const signingInput = headerLines.join('\r\n');

  // Sign with RSA-SHA256 using the domain's private key
  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = signer.sign(privateKey, 'base64');
    return `${dkimHeader}${signature}`;
  } catch (err) {
    return null;
  }
}

function computeBodyHash(txn) {
  const body = txn.body ? txn.body.toString() : '';

  // Relaxed body canonicalization (RFC 6376):
  //   - Remove trailing whitespace from each line
  //   - Convert line endings to CRLF
  //   - Remove trailing empty lines (leave one CRLF)
  const canonicalized = body
    .replace(/[ \t]+\r?\n/g, '\r\n')
    .replace(/\r?\n/g, '\r\n')
    .replace(/(\r\n)+$/, '\r\n');

  return crypto.createHash('sha256').update(canonicalized).digest('base64');
}
