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

const VALID_USER = process.env.HARAKA_USER || 'system';
const VALID_PASS = process.env.HARAKA_PASS || 'localdev';

exports.register = function () {
  this.inherits('auth/auth_base');
  this.loginfo(`auth_api registered (user=${VALID_USER}, pass_length=${VALID_PASS.length})`);
};

// auth_base calls this to verify PLAIN and LOGIN credentials
exports.check_plain_passwd = function (connection, user, passwd, cb) {
  const receivedHex = Buffer.from(passwd).toString('hex');
  const expectedHex = Buffer.from(VALID_PASS).toString('hex');
  connection.loginfo(this, `Auth attempt: user="${user}" (len=${user.length}), pass received len=${passwd.length} hex=${receivedHex}, expected len=${VALID_PASS.length} hex=${expectedHex}`);

  if (user === VALID_USER && passwd === VALID_PASS) {
    connection.loginfo(this, `Auth SUCCESS for ${user}`);
    connection.notes.auth_user = user;
    return cb(true);
  }

  connection.logwarn(this, `Auth FAILED for ${user}`);
  return cb(false);
};
