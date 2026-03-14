'use strict';

const http = require('node:http');
const https = require('node:https');
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://api:3000/webhooks/haraka';

exports.register = function () {
  this.loginfo('bounce_webhook plugin registered');
};

exports.hook_bounce = function (next, hmail, error) {
  const notes = hmail.notes || {};

  let dsnCode = '5.0.0';
  let dsnMsg = 'Unknown bounce';

  if (error) {
    dsnMsg = typeof error === 'string' ? error : error.message || 'Unknown bounce';
    const dsnMatch = dsnMsg.match(/(\d\.\d\.\d)/);
    if (dsnMatch) {
      dsnCode = dsnMatch[1];
    }
  }

  const isHardBounce = dsnCode.startsWith('5');
  const event = isHardBounce ? 'bounced' : 'deferred';

  const payload = {
    event,
    messageId: hmail.uuid || null,
    recipient: (hmail.rcpt_to && hmail.rcpt_to[0] && hmail.rcpt_to[0].original) || 'unknown',
    timestamp: Date.now(),
    dsnCode,
    dsnMsg,
    campaignId: notes.campaignId || null,
    contactId: notes.contactId || null,
    accountId: notes.accountId || null,
  };

  // Fire and forget
  postWebhook(payload, this);
  next();
};

function postWebhook(payload, plugin) {
  const data = JSON.stringify(payload);
  const isHttps = WEBHOOK_URL.startsWith('https:');
  const transport = isHttps ? https : http;

  const req = transport.request(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    timeout: 5000,
  }, (res) => {
    if (res.statusCode >= 400) {
      plugin.logwarn(`Bounce webhook failed: ${res.statusCode}`);
    } else {
      plugin.loginfo(`Bounce webhook sent: ${payload.event} for ${payload.recipient}`);
    }
    res.resume();
  });

  req.on('error', (err) => plugin.logerror(`Bounce webhook error: ${err.message}`));
  req.write(data);
  req.end();
}
