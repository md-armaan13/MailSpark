export type Plan = 'free' | 'starter' | 'growth' | 'pro';

export interface Account {
  id: string;
  companyName: string;
  plan: Plan;
  monthlyLimit: number;
  emailsSent: number;
  createdAt: Date;
  updatedAt: Date;
}
