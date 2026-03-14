'use strict';

const { createClient } = require('redis');

let redisClient = null;

exports.register = function () {
  this.loginfo('rate_limit plugin registered');
};

exports.hook_init_master = async function (next) {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => this.logerror(`Redis error: ${err.message}`));
    await redisClient.connect();
    this.loginfo('rate_limit: Redis connected (master)');
  } catch (err) {
    this.logerror(`rate_limit: Redis connect failed: ${err.message}`);
  }
  next();
};

exports.hook_init_child = async function (next) {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => this.logerror(`Redis error: ${err.message}`));
    await redisClient.connect();
    this.logdebug('rate_limit: Redis connected (child)');
  } catch (err) {
    this.logerror(`rate_limit: Redis connect failed: ${err.message}`);
  }
  next();
};

exports.hook_mail = async function (next, connection, params) {
  if (!redisClient || !redisClient.isOpen) {
    this.logwarn('rate_limit: Redis not available, skipping check');
    return next();
  }

  // Use the authenticated SMTP username as the rate-limit key.
  // hook_mail fires BEFORE headers are received (DATA stage),
  // so we cannot read X-Account-ID here.
  const accountId =
    (connection.notes && connection.notes.auth_user) || 'default';

  const key = `ratelimit:${accountId.trim()}`;
  const windowSec = 3600;
  const maxPerHour = 10000;

  try {
    const now = Date.now();
    const windowStart = now - windowSec * 1000;

    await redisClient.zRemRangeByScore(key, 0, windowStart);
    const count = await redisClient.zCard(key);

    if (count >= maxPerHour) {
      connection.logwarn(
        this,
        `Rate limit exceeded for account ${accountId}: ${count}/${maxPerHour}`,
      );
      return next(DENY, 'Rate limit exceeded. Try again later.');
    }

    await redisClient.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
    await redisClient.expire(key, windowSec);

    connection.logdebug(this, `Rate: ${count + 1}/${maxPerHour} for account ${accountId}`);
    next();
  } catch (err) {
    this.logerror(`rate_limit error: ${err.message}`);
    next();
  }
};
