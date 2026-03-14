import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

// Domain can be: pending (just added), verified (DNS records confirmed), failed (DNS check failed)
export const domainStatusEnum = pgEnum('domain_status', ['pending', 'verified', 'failed']);

export const sendingDomains = pgTable('sending_domains', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Which account owns this domain
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  // The domain name, e.g. "nike.com"
  domain: varchar('domain', { length: 255 }).notNull(),

  // Verification status
  status: domainStatusEnum('status').notNull().default('pending'),

  // DKIM selector — the prefix used in DNS record (default._domainkey.nike.com)
  dkimSelector: varchar('dkim_selector', { length: 50 }).notNull().default('default'),

  // Private key — Haraka uses this to SIGN emails (never exposed to users)
  dkimPrivateKey: text('dkim_private_key').notNull(),

  // Public key — shown to users so they can add it to their DNS
  dkimPublicKey: text('dkim_public_key').notNull(),

  // Which DNS records has the user verified?
  spfVerified: boolean('spf_verified').notNull().default(false),
  dkimVerified: boolean('dkim_verified').notNull().default(false),
  dmarcVerified: boolean('dmarc_verified').notNull().default(false),

  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Fast lookup: "find all domains for this account"
  accountDomainIdx: index('sending_domains_account_domain_idx').on(table.accountId, table.domain),
  // Fast lookup: "find the DKIM key for this domain" (used by Haraka plugin)
  domainIdx: index('sending_domains_domain_idx').on(table.domain),
}));
