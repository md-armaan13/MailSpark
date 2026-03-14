import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

export const suppressionList = pgTable('suppression_list', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  reason: varchar('reason', { length: 50 }).notNull(),
  dsnCode: varchar('dsn_code', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountEmailIdx: uniqueIndex('suppression_account_email_idx').on(table.accountId, table.email),
}));
