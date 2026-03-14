#!/usr/bin/env node

/**
 * Email Delivery Stats CLI
 *
 * Shows real-time email delivery status from Redis.
 *
 * Usage:
 *   node scripts/email-stats.js                  # Dashboard overview
 *   node scripts/email-stats.js recent            # Last 20 emails
 *   node scripts/email-stats.js recent 50         # Last 50 emails
 *   node scripts/email-stats.js bounced           # Recent bounces
 *   node scripts/email-stats.js delivered         # Recent deliveries
 *   node scripts/email-stats.js queued            # Currently queued
 *   node scripts/email-stats.js detail <uuid>     # Full event log for one email
 *   node scripts/email-stats.js live              # Live tail (watch mode)
 */

const { createClient } = require('redis');

// In dev, Docker Redis is on 6380 to avoid conflict with local Redis.
// On VPS (production), it's 6379 as normal.
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

async function main() {
  const client = createClient({ url: REDIS_URL });
  client.on('error', (err) => {
    console.error(`Redis error: ${err.message}`);
    process.exit(1);
  });
  await client.connect();

  const command = process.argv[2] || 'dashboard';
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'dashboard':
        await showDashboard(client);
        break;
      case 'recent':
        await showRecent(client, parseInt(arg) || 20);
        break;
      case 'bounced':
        await showByStatus(client, 'bounced', parseInt(arg) || 20);
        break;
      case 'delivered':
        await showByStatus(client, 'delivered', parseInt(arg) || 20);
        break;
      case 'queued':
        await showByStatus(client, 'queued', parseInt(arg) || 20);
        break;
      case 'deferred':
        await showByStatus(client, 'deferred', parseInt(arg) || 20);
        break;
      case 'detail':
        if (!arg) {
          console.error('Usage: email-stats detail <uuid>');
          process.exit(1);
        }
        await showDetail(client, arg);
        break;
      case 'live':
        await liveTail(client);
        return; // Don't disconnect — live mode runs forever
      default:
        console.log('Unknown command. Use: dashboard, recent, bounced, delivered, queued, detail <uuid>, live');
    }
  } finally {
    await client.disconnect();
  }
}

// ─── DASHBOARD ──────────────────────────────────────────────

async function showDashboard(client) {
  const totalStats = await client.hGetAll('email:stats:total');
  const today = new Date().toISOString().split('T')[0];
  const todayStats = await client.hGetAll(`email:stats:${today}`);

  const total = {
    queued: parseInt(totalStats.queued || 0),
    delivered: parseInt(totalStats.delivered || 0),
    bounced: parseInt(totalStats.bounced || 0),
    deferred: parseInt(totalStats.deferred || 0),
  };

  const todayN = {
    queued: parseInt(todayStats.queued || 0),
    delivered: parseInt(todayStats.delivered || 0),
    bounced: parseInt(todayStats.bounced || 0),
    deferred: parseInt(todayStats.deferred || 0),
  };

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║            MAILSPARK EMAIL DASHBOARD                ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║                                                      ║');
  console.log(`║  ALL TIME                                            ║`);
  console.log(`║    Queued:     ${pad(total.queued)}                          ║`);
  console.log(`║    Delivered:  ${pad(total.delivered)}   ${bar(total.delivered, total.queued, 'green')}  ║`);
  console.log(`║    Bounced:    ${pad(total.bounced)}   ${bar(total.bounced, total.queued, 'red')}  ║`);
  console.log(`║    Deferred:   ${pad(total.deferred)}   ${bar(total.deferred, total.queued, 'yellow')}  ║`);
  console.log('║                                                      ║');

  if (total.queued > 0) {
    const deliveryRate = ((total.delivered / total.queued) * 100).toFixed(1);
    const bounceRate = ((total.bounced / total.queued) * 100).toFixed(1);
    console.log(`║    Delivery Rate: ${deliveryRate}%                          ║`);
    console.log(`║    Bounce Rate:   ${bounceRate}%                          ║`);
    console.log('║                                                      ║');
  }

  console.log(`║  TODAY (${today})                              ║`);
  console.log(`║    Queued: ${todayN.queued}  Delivered: ${todayN.delivered}  Bounced: ${todayN.bounced}  Deferred: ${todayN.deferred}     ║`);
  console.log('║                                                      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Commands:');
  console.log('  node scripts/email-stats.js recent      Last 20 emails');
  console.log('  node scripts/email-stats.js bounced     Recent bounces');
  console.log('  node scripts/email-stats.js delivered   Recent deliveries');
  console.log('  node scripts/email-stats.js detail <id> Full event log');
  console.log('  node scripts/email-stats.js live        Live event stream');
  console.log('');
}

// ─── RECENT EMAILS ──────────────────────────────────────────

async function showRecent(client, count) {
  const uuids = await client.zRange('emails:recent', -count, -1);
  if (!uuids.length) {
    console.log('\nNo emails found.\n');
    return;
  }

  console.log('');
  console.log(`  RECENT EMAILS (last ${uuids.length})`);
  console.log('  ' + '─'.repeat(100));
  console.log(`  ${'STATUS'.padEnd(12)} ${'UUID'.padEnd(40)} ${'FROM'.padEnd(25)} ${'TO'.padEnd(25)} SUBJECT`);
  console.log('  ' + '─'.repeat(100));

  // Reverse to show newest first
  for (const uuid of uuids.reverse()) {
    const data = await client.hGetAll(`email:${uuid}`);
    if (!data || !data.status) continue;

    const statusIcon = statusEmoji(data.status || data.lastEvent);
    const from = truncate(data.from || '', 23);
    const to = truncate(data.to || data.recipient || '', 23);
    const subject = truncate(data.subject || '', 40);

    console.log(`  ${statusIcon} ${uuid.padEnd(40)} ${from.padEnd(25)} ${to.padEnd(25)} ${subject}`);
  }
  console.log('');
}

// ─── BY STATUS ──────────────────────────────────────────────

async function showByStatus(client, status, count) {
  const uuids = await client.zRange(`emails:${status}`, -count, -1);
  if (!uuids.length) {
    console.log(`\nNo ${status} emails found.\n`);
    return;
  }

  console.log('');
  console.log(`  ${status.toUpperCase()} EMAILS (last ${uuids.length})`);
  console.log('  ' + '─'.repeat(100));

  for (const uuid of uuids.reverse()) {
    const data = await client.hGetAll(`email:${uuid}`);
    if (!data) continue;

    const time = data.bouncedAt || data.deliveredAt || data.queuedAt || data.lastEventAt;
    const timeStr = time ? new Date(parseInt(time)).toLocaleString() : 'unknown';
    const from = truncate(data.from || '', 25);
    const to = truncate(data.to || data.recipient || '', 25);

    console.log(`  ${statusEmoji(status)} ${uuid}`);
    console.log(`     Time: ${timeStr}`);
    console.log(`     From: ${from}  To: ${to}`);

    if (status === 'bounced' || status === 'deferred') {
      console.log(`     DSN:  ${data.dsnCode || '?'}  ${truncate(data.dsnMsg || '', 80)}`);
    }
    console.log('');
  }
}

// ─── DETAIL ─────────────────────────────────────────────────

async function showDetail(client, searchUuid) {
  // Support partial UUID match
  let uuid = searchUuid;
  const uuids = await client.zRange('emails:recent', 0, -1);
  const match = uuids.find(u => u.startsWith(searchUuid) || u.includes(searchUuid));
  if (match) uuid = match;

  const data = await client.hGetAll(`email:${uuid}`);
  if (!data || Object.keys(data).length === 0) {
    console.log(`\nEmail not found: ${uuid}`);
    console.log('Tip: Use a UUID from "email-stats recent"\n');
    return;
  }

  console.log('');
  console.log(`  EMAIL DETAIL: ${uuid}`);
  console.log('  ' + '─'.repeat(60));
  console.log(`  Status:      ${statusEmoji(data.status || data.lastEvent)} ${(data.status || data.lastEvent || '').toUpperCase()}`);
  console.log(`  Message-ID:  ${data.messageId || 'n/a'}`);
  console.log(`  From:        ${data.from || 'n/a'}`);
  console.log(`  To:          ${data.to || data.recipient || 'n/a'}`);
  console.log(`  Subject:     ${data.subject || 'n/a'}`);
  console.log(`  Size:        ${data.size ? data.size + ' bytes' : 'n/a'}`);
  console.log(`  Campaign:    ${data.campaignId || 'n/a'}`);
  console.log(`  Contact:     ${data.contactId || 'n/a'}`);
  console.log(`  Account:     ${data.accountId || 'n/a'}`);

  if (data.dsnCode) {
    console.log(`  DSN Code:    ${data.dsnCode}`);
    console.log(`  DSN Message: ${data.dsnMsg}`);
  }

  // Show event timeline
  const events = await client.lRange(`email:${uuid}:events`, 0, -1);
  if (events.length) {
    console.log('');
    console.log('  EVENT TIMELINE:');
    console.log('  ' + '─'.repeat(60));
    for (const raw of events) {
      try {
        const evt = JSON.parse(raw);
        const time = new Date(evt.timestamp).toLocaleString();
        const icon = statusEmoji(evt.event);
        console.log(`  ${icon} ${time}  ${evt.event.toUpperCase()}`);
        if (evt.dsnCode) {
          console.log(`     DSN: ${evt.dsnCode} ${truncate(evt.dsnMsg || '', 70)}`);
        }
        if (evt.recipient && evt.event !== 'queued') {
          console.log(`     Recipient: ${evt.recipient}`);
        }
      } catch {
        console.log(`  ? ${raw}`);
      }
    }
  }
  console.log('');
}

// ─── LIVE TAIL ──────────────────────────────────────────────

async function liveTail(client) {
  console.log('');
  console.log('  LIVE EMAIL STREAM (Ctrl+C to stop)');
  console.log('  ' + '─'.repeat(80));
  console.log('');

  let lastCheck = Date.now();

  const poll = async () => {
    // Get emails added since last check
    const uuids = await client.zRangeByScore('emails:recent', lastCheck, '+inf');
    lastCheck = Date.now();

    for (const uuid of uuids) {
      const data = await client.hGetAll(`email:${uuid}`);
      if (!data) continue;

      const time = new Date().toLocaleTimeString();
      const status = data.lastEvent || data.status || 'unknown';
      const from = truncate(data.from || '', 25);
      const to = truncate(data.to || data.recipient || '', 25);
      const subject = truncate(data.subject || '', 35);

      console.log(`  ${time}  ${statusEmoji(status)} ${status.toUpperCase().padEnd(10)} ${from.padEnd(25)} → ${to.padEnd(25)} ${subject}`);

      if (data.dsnMsg && (status === 'bounced' || status === 'deferred')) {
        console.log(`           DSN: ${data.dsnCode} ${truncate(data.dsnMsg, 60)}`);
      }
    }
  };

  // Poll every 2 seconds
  setInterval(poll, 2000);

  // Keep alive
  process.on('SIGINT', async () => {
    console.log('\n  Stream stopped.\n');
    await client.disconnect();
    process.exit(0);
  });
}

// ─── HELPERS ────────────────────────────────────────────────

function statusEmoji(status) {
  const map = {
    queued: '📤 QUEUED   ',
    delivered: '✅ DELIVERED',
    bounced: '❌ BOUNCED  ',
    deferred: '⏳ DEFERRED ',
  };
  return map[status] || `❓ ${(status || '?').padEnd(9)}`;
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len - 1) + '…' : str;
}

function pad(num) {
  return String(num).padStart(6);
}

function bar(value, total, color) {
  if (!total || total === 0) return '';
  const pct = Math.round((value / total) * 100);
  const filled = Math.round(pct / 5); // 20 char bar
  const empty = 20 - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${pct}%`;
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
