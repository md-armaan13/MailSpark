export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent';

export interface Campaign {
  id: string;
  accountId: string;
  listId: string | null;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  htmlContent: string;
  status: CampaignStatus;
  scheduledAt: Date | null;
  sentAt: Date | null;
  stats: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}
