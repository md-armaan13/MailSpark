import { pgTable, uuid, varchar, timestamp, jsonb, text, pgEnum, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

export const contactStatusEnum = pgEnum('contact_status', ['subscribed', 'unsubscribed', 'bounced']);

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  status: contactStatusEnum('status').notNull().default('subscribed'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountStatusIdx: index('contacts_account_status_idx').on(table.accountId, table.status),
  accountEmailIdx: index('contacts_account_email_idx').on(table.accountId, table.email),
}));
