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
 */

exports.register = function () {
  this.inherits('auth/auth_base');
  const user = process.env.HARAKA_USER || 'system';
  this.loginfo(`auth_api registered (user=${user}, pass_length=${(process.env.HARAKA_PASS || '').length})`);
};

// auth_base calls this to verify PLAIN and LOGIN credentials
// NOTE: env vars are read at call time, not module load time,
// because Haraka workers may not have env vars set during module init.
exports.check_plain_passwd = function (connection, user, passwd, cb) {
  const validUser = process.env.HARAKA_USER || 'system';
  const validPass = process.env.HARAKA_PASS || 'localdev';

  connection.loginfo(this, `Auth attempt: user="${user}", expected="${validUser}", user_match=${user === validUser}, pass_match=${passwd === validPass}`);

  if (user === validUser && passwd === validPass) {
    connection.loginfo(this, `Auth SUCCESS for ${user}`);
    connection.notes.auth_user = user;
    return cb(true);
  }

  connection.logwarn(this, `Auth FAILED for ${user}`);
  return cb(false);
};
