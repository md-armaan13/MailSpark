import { pgTable, uuid, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { campaigns } from './campaigns.js';
import { contacts } from './contacts.js';

export const eventTypeEnum = pgEnum('event_type', [
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'unsubscribed',
]);

export const emailEvents = pgTable('email_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  eventType: eventTypeEnum('event_type').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  campaignIdx: index('email_events_campaign_idx').on(table.campaignId),
  campaignEventIdx: index('email_events_campaign_event_idx').on(table.campaignId, table.eventType),
  createdAtIdx: index('email_events_created_at_idx').on(table.createdAt),
}));
