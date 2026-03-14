#!/usr/bin/env node

/**
 * Test script: Send an email through the local Haraka SMTP server.
 *
 * Usage:
 *   node scripts/test-haraka.js <recipient-email>
 *
 * Example:
 *   node scripts/test-haraka.js yourname@gmail.com
 *
 * Prerequisites:
 *   - docker compose up -d redis haraka
 *   - Haraka listening on localhost:587
 */

const nodemailer = require('nodemailer');

const HARAKA_HOST = process.env.HARAKA_HOST || 'localhost';
const HARAKA_PORT = parseInt(process.env.HARAKA_PORT || '587', 10);
const HARAKA_USER = process.env.HARAKA_USER || 'system';
const HARAKA_PASS = process.env.HARAKA_PASS || 'localdev';

const recipient = process.argv[2];

if (!recipient) {
  console.error('Usage: node scripts/test-haraka.js <recipient-email>');
  process.exit(1);
}

async function main() {
  console.log('=== Haraka SMTP Test ===\n');
  console.log(`Host:      ${HARAKA_HOST}:${HARAKA_PORT}`);
  console.log(`Auth:      ${HARAKA_USER}`);
  console.log(`Recipient: ${recipient}\n`);

  // Step 1: Create SMTP transport
  // - tls.rejectUnauthorized=false because we're using a self-signed cert
  // - STARTTLS is attempted but not required for local dev
  const transporter = nodemailer.createTransport({
    host: HARAKA_HOST,
    port: HARAKA_PORT,
    secure: false, // Use STARTTLS, not implicit TLS
    auth: {
      user: HARAKA_USER,
      pass: HARAKA_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Accept self-signed certs in dev
    },
  });

  // Step 2: Verify connection
  console.log('1. Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('   ✓ Connected and authenticated successfully\n');
  } catch (err) {
    console.error(`   ✗ Connection failed: ${err.message}`);
    process.exit(1);
  }

  // Step 3: Send test email
  // Include custom headers that Haraka plugins will process:
  //   X-Campaign-ID  → add_tracking plugin reads this
  //   X-Contact-ID   → add_tracking plugin reads this
  //   X-Account-ID   → add_tracking plugin reads + strips before delivery
  console.log('2. Sending test email...');
  const info = await transporter.sendMail({
    from: `"Mailspark Test" <test@${process.env.SENDING_DOMAIN || 'yourdomain.com'}>`,
    to: recipient,
    subject: `Mailspark Test Email - ${new Date().toISOString()}`,
    text: 'This is a plain-text test email sent through the Haraka SMTP server.',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Mailspark Test Email</h1>
        <p>This email was sent through the <strong>Haraka SMTP server</strong>.</p>
        <hr>
        <h3>What was tested:</h3>
        <ul>
          <li>SMTP authentication (auth_api plugin)</li>
          <li>Rate limiting (custom_rate_limit plugin)</li>
          <li>Tracking header processing (add_tracking plugin)</li>
          <li>DKIM signing attempt (custom_dkim_sign plugin)</li>
          <li>Delivery webhook (delivery_webhook plugin)</li>
          <li>Bounce webhook (bounce_webhook plugin)</li>
        </ul>
        <hr>
        <p style="color: #6b7280; font-size: 12px;">
          Sent at ${new Date().toISOString()} via Haraka ${HARAKA_HOST}:${HARAKA_PORT}
        </p>
      </div>
    `,
    headers: {
      'X-Campaign-ID': 'test-campaign-001',
      'X-Contact-ID': 'test-contact-001',
      'X-Account-ID': 'test-account-001',
    },
  });

  console.log(`   ✓ Email accepted by Haraka`);
  console.log(`   Message ID: ${info.messageId}`);
  console.log(`   Response:   ${info.response}\n`);

  console.log('=== Done ===');
  console.log(
    'Check Haraka logs:  docker compose logs -f haraka',
  );
  console.log(
    `Check recipient inbox: ${recipient}`,
  );
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
