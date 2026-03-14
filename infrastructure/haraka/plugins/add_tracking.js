'use strict';

exports.register = function () {
  this.loginfo('add_tracking plugin registered');
};

exports.hook_data_post = function (next, connection) {
  const txn = connection.transaction;
  if (!txn) return next();

  const campaignId = txn.header.get('X-Campaign-ID');
  const contactId = txn.header.get('X-Contact-ID');
  const accountId = txn.header.get('X-Account-ID');

  txn.notes.campaignId = campaignId ? campaignId.trim() : null;
  txn.notes.contactId = contactId ? contactId.trim() : null;
  txn.notes.accountId = accountId ? accountId.trim() : null;

  if (!txn.header.get('X-Mailspark-ID')) {
    txn.header.add('X-Mailspark-ID', txn.uuid);
  }

  // Strip internal-only header before outbound delivery
  txn.header.remove('X-Account-ID');

  connection.logdebug(
    this,
    `Tracking: campaign=${txn.notes.campaignId}, contact=${txn.notes.contactId}`,
  );
  next();
};
