export type ContactStatus = 'subscribed' | 'unsubscribed' | 'bounced';

export interface Contact {
  id: string;
  accountId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: ContactStatus;
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
