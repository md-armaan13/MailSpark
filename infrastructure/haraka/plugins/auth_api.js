'use strict';

/**
 * auth_api plugin — SMTP AUTH handler using auth_base.
 *
 * Inherits from auth/auth_base which handles:
 *   - Advertising AUTH methods in EHLO
 *   - Parsing AUTH PLAIN and AUTH LOGIN exchanges
 *   - Calling check_plain_passwd for credential verification
 *
 * We only need to implement check_plain_passwd.
 * NOTE: env vars are read at call time, not module load time,
 * because Haraka workers may not have env vars set during module init.
 */

exports.register = function () {
  this.inherits('auth/auth_base');
  this.loginfo('auth_api registered');
};

exports.check_plain_passwd = function (connection, user, passwd, cb) {
  const validUser = process.env.HARAKA_USER || 'system';
  const validPass = process.env.HARAKA_PASS || 'localdev';

  if (user === validUser && passwd === validPass) {
    connection.loginfo(this, `Auth SUCCESS for ${user}`);
    connection.notes.auth_user = user;
    return cb(true);
  }

  connection.logwarn(this, `Auth FAILED for ${user}`);
  return cb(false);
};
