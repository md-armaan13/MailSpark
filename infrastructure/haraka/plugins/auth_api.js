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
  const passLen = (process.env.HARAKA_PASS || '').length;
  this.loginfo(`auth_api registered (user=${user}, pass_length=${passLen}, HARAKA_PASS_defined=${!!process.env.HARAKA_PASS})`);
};

// auth_base calls this to verify PLAIN and LOGIN credentials
// NOTE: env vars are read at call time, not module load time,
// because Haraka workers may not have env vars set during module init.
exports.check_plain_passwd = function (connection, user, passwd, cb) {
  const validUser = process.env.HARAKA_USER;
  const validPass = process.env.HARAKA_PASS;

  // Debug: log actual values to diagnose mismatch (remove after fix is confirmed)
  connection.loginfo(this, `Auth DEBUG: received_user="${user}" received_pass="${passwd}" expected_user="${validUser}" expected_pass="${validPass}"`);
  connection.loginfo(this, `Auth DEBUG: user_match=${user === validUser} pass_match=${passwd === validPass} validPass_defined=${!!validPass}`);

  if (user === validUser && passwd === validPass) {
    connection.loginfo(this, `Auth SUCCESS for ${user}`);
    connection.notes.auth_user = user;
    return cb(true);
  }

  connection.logwarn(this, `Auth FAILED for ${user}`);
  return cb(false);
};
