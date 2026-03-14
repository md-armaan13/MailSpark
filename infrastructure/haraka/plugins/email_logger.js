'use strict';

/**
 * email_logger — Central event log for every email passing through Haraka.
 *
 * Stores events in Redis:
 *   - Hash   "email:{uuid}"        → full email metadata + status
 *   - List   "email:{uuid}:events" → ordered event log per email
 *   - Sorted Set "emails:recent"   → last N emails (score = timestamp)
 *   - Sorted Set "emails:bounced"  → bounced emails
 *   - Sorted Set "emails:delivered"→ delivered emails
 *   - Sorted Set "emails:queued"   → queued emails
 *
 * Other plugins call:
 *   connection.server.plugins.email_logger.log_event(...)
 *
 * Or we hook into all lifecycle stages directly.
 */

const { createClient } = require('redis');

const MAX_RECENT = 1000; // Keep last 1000 emails in sorted sets

let redisClient = null;

exports.register = function () {
  this.loginfo('email_logger plugin registered');
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
    redisClient.on('error', (err) => plugin.logerror(`email_logger Redis error: ${err.message}`));
    await redisClient.connect();
    plugin.logdebug('email_logger: Redis connected');
  } catch (err) {
    plugin.logerror(`email_logger: Redis connect failed: ${err.message}`);
  }
}

// ─── HOOK: Email accepted into queue ────────────────────────
// Fires after DATA is accepted and message is queued for outbound delivery
exports.hook_queue_ok = function (next, connection) {
  const txn = connection.transaction;
  if (!txn) return next();

  const uuid = txn.uuid || 'unknown';
  const now = Date.now();

  const emailData = {
    uuid,
    messageId: txn.header.get('Message-Id') ? txn.header.get('Message-Id').trim() : '',
    from: txn.mail_from ? txn.mail_from.original : '',
    to: txn.rcpt_to ? txn.rcpt_to.map(r => r.original).join(', ') : '',
    subject: txn.header.get('Subject') ? txn.header.get('Subject').trim() : '',
    campaignId: txn.notes.campaignId || '',
    contactId: txn.notes.contactId || '',
    accountId: txn.notes.accountId || '',
    status: 'queued',
    queuedAt: now,
    size: txn.data_bytes || 0,
  };

  logToRedis('queued', uuid, emailData, this);
  next();
};

// ─── HOOK: Email delivered successfully ─────────────────────
exports.hook_delivered = function (next, hmail, params) {
  const uuid = hmail.uuid || 'unknown';
  const recipient = (params && params[0]) ||
    (hmail.rcpt_to && hmail.rcpt_to[0] && hmail.rcpt_to[0].original) || 'unknown';

  const eventData = {
    status: 'delivered',
    recipient,
    deliveredAt: Date.now(),
  };

  logToRedis('delivered', uuid, eventData, this);
  next();
};

// ─── HOOK: Email bounced ────────────────────────────────────
exports.hook_bounce = function (next, hmail, error) {
  const uuid = hmail.uuid || 'unknown';
  const recipient = (hmail.rcpt_to && hmail.rcpt_to[0] && hmail.rcpt_to[0].original) || 'unknown';

  let dsnCode = '5.0.0';
  let dsnMsg = 'Unknown bounce';
  if (error) {
    dsnMsg = typeof error === 'string' ? error : error.message || 'Unknown bounce';
    const dsnMatch = dsnMsg.match(/(\d\.\d\.\d)/);
    if (dsnMatch) dsnCode = dsnMatch[1];
  }

  const isHard = dsnCode.startsWith('5');

  const eventData = {
    status: isHard ? 'bounced' : 'deferred',
    recipient,
    dsnCode,
    dsnMsg: dsnMsg.substring(0, 500), // truncate long messages
    bouncedAt: Date.now(),
  };

  logToRedis(isHard ? 'bounced' : 'deferred', uuid, eventData, this);
  next();
};

// ─── HOOK: Connection disconnect (log send attempts) ────────
exports.hook_disconnect = function (next, connection) {
  // Just log the connection summary for debugging
  if (connection.transaction && connection.transaction.uuid) {
    this.logdebug(`email_logger: disconnect for ${connection.transaction.uuid}`);
  }
  next();
};

// ─── REDIS LOGGING ──────────────────────────────────────────

async function logToRedis(eventType, uuid, data, plugin) {
  if (!redisClient || !redisClient.isOpen) {
    plugin.logwarn('email_logger: Redis not available, event not logged');
    return;
  }

  const now = Date.now();

  try {
    const pipeline = redisClient.multi();

    // 1. Update the email hash with latest data
    const hashKey = `email:${uuid}`;
    for (const [key, value] of Object.entries(data)) {
      pipeline.hSet(hashKey, key, String(value));
    }
    pipeline.hSet(hashKey, 'lastEvent', eventType);
    pipeline.hSet(hashKey, 'lastEventAt', String(now));
    pipeline.expire(hashKey, 7 * 24 * 3600); // TTL: 7 days

    // 2. Append to the event log for this email
    const eventKey = `email:${uuid}:events`;
    const eventEntry = JSON.stringify({
      event: eventType,
      timestamp: now,
      ...data,
    });
    pipeline.rPush(eventKey, eventEntry);
    pipeline.expire(eventKey, 7 * 24 * 3600);

    // 3. Add to the appropriate sorted set (score = timestamp)
    pipeline.zAdd('emails:recent', { score: now, value: uuid });
    pipeline.zAdd(`emails:${eventType}`, { score: now, value: uuid });

    // 4. Trim sorted sets to MAX_RECENT entries
    pipeline.zRemRangeByRank('emails:recent', 0, -(MAX_RECENT + 1));
    pipeline.zRemRangeByRank(`emails:${eventType}`, 0, -(MAX_RECENT + 1));

    // 5. Increment counters (for quick stats)
    const dateKey = new Date().toISOString().split('T')[0]; // "2026-03-14"
    pipeline.hIncrBy('email:stats:total', eventType, 1);
    pipeline.hIncrBy(`email:stats:${dateKey}`, eventType, 1);
    pipeline.expire(`email:stats:${dateKey}`, 90 * 24 * 3600); // 90 days

    await pipeline.exec();
    plugin.loginfo(`email_logger: [${eventType.toUpperCase()}] ${uuid} → ${data.to || data.recipient || ''}`);
  } catch (err) {
    plugin.logerror(`email_logger: Redis write error: ${err.message}`);
  }
}
