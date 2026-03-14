export type EventType = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed';

export interface EmailEvent {
  id: string;
  campaignId: string;
  contactId: string;
  eventType: EventType;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
