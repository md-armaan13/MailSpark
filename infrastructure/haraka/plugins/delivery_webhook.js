'use strict';

const http = require('node:http');
const https = require('node:https');
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://api:3000/webhooks/haraka';

exports.register = function () {
  this.loginfo('delivery_webhook plugin registered');
};

exports.hook_delivered = function (next, hmail, params) {
  const notes = hmail.notes || {};

  const payload = {
    event: 'delivered',
    messageId: hmail.uuid || null,
    recipient: (params && params[0]) || (hmail.rcpt_to && hmail.rcpt_to[0] && hmail.rcpt_to[0].original) || 'unknown',
    timestamp: Date.now(),
    dsnCode: '2.0.0',
    dsnMsg: 'Message delivered successfully',
    campaignId: notes.campaignId || null,
    contactId: notes.contactId || null,
    accountId: notes.accountId || null,
  };

  // Fire and forget — do not block delivery pipeline
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
      plugin.logwarn(`Webhook POST failed: ${res.statusCode}`);
    } else {
      plugin.logdebug(`Webhook POST success for ${payload.messageId}`);
    }
    res.resume();
  });

  req.on('error', (err) => plugin.logerror(`Webhook POST error: ${err.message}`));
  req.write(data);
  req.end();
}
