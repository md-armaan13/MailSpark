export type HarakaWebhookEvent = 'delivered' | 'bounced' | 'deferred';

export interface HarakaWebhookPayload {
  event: HarakaWebhookEvent;
  messageId: string | null;
  recipient: string;
  timestamp: number;
  dsnCode: string;
  dsnMsg: string;
  accountId: string | null;
  campaignId: string | null;
  contactId: string | null;
}
