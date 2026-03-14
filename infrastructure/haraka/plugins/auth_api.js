'use strict';

/**
 * auth_api plugin — Authenticates SMTP users against env-based credentials.
 *
 * Inherits from Haraka's built-in auth/auth_base which:
 *   1. Advertises AUTH PLAIN LOGIN CRAM-MD5 in EHLO capabilities
 *   2. Handles the AUTH command via hook_unrecognized_command
 *   3. Calls our get_plain_passwd() to verify credentials
 *
 * In production, you would replace the env-based lookup with an API call
 * to your user database to support multi-tenant authentication.
 */

exports.register = function () {
  this.inherits('auth/auth_base');
  this.loginfo('auth_api plugin registered (inherits auth_base)');
};

/**
 * Called by auth_base when a user attempts PLAIN or LOGIN authentication.
 * We return the expected password — auth_base compares it to what the user sent.
 *
 * @param {string}   user       - The SMTP username
 * @param {object}   connection - The Haraka connection object
 * @param {function} cb         - Callback: cb(password) or cb(null) to reject
 */
exports.get_plain_passwd = function (user, connection, cb) {
  const validUser = process.env.HARAKA_USER || 'system';
  const validPass = process.env.HARAKA_PASS || 'localdev';

  if (user === validUser) {
    connection.loginfo(this, `Auth lookup for user: ${user}`);
    connection.notes.auth_user = user;
    return cb(validPass);
  }

  connection.logwarn(this, `Auth rejected unknown user: ${user}`);
  return cb(null);
};
