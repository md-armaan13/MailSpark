import { pgTable, uuid, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { lists } from './lists.js';
import { contacts } from './contacts.js';

export const listContacts = pgTable('list_contacts', {
  listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.listId, table.contactId] }),
}));
