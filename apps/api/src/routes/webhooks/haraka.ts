import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@email-platform/database';
import { emailEvents, contacts, suppressionList } from '@email-platform/database/schema';
import { eq } from 'drizzle-orm';

const webhookSchema = z.object({
  event: z.enum(['delivered', 'bounced', 'deferred']),
  messageId: z.string().nullable(),
  recipient: z.string(),
  timestamp: z.number(),
  dsnCode: z.string(),
  dsnMsg: z.string(),
  campaignId: z.string().uuid().nullable(),
  contactId: z.string().uuid().nullable(),
  accountId: z.string().uuid().nullable(),
});

export async function harakaWebhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhooks/haraka', async (request, reply) => {
    const result = webhookSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid webhook payload',
      });
    }

    const payload = result.data;
    const eventType = payload.event === 'deferred' ? 'delivered' : payload.event;

    if (payload.campaignId && payload.contactId) {
      await db.insert(emailEvents).values({
        campaignId: payload.campaignId,
        contactId: payload.contactId,
        eventType,
        metadata: {
          dsnCode: payload.dsnCode,
          dsnMsg: payload.dsnMsg,
          messageId: payload.messageId,
        },
      });
    }

    if (payload.event === 'bounced' && payload.contactId && payload.accountId) {
      await db
        .update(contacts)
        .set({ status: 'bounced', updatedAt: new Date() })
        .where(eq(contacts.id, payload.contactId));

      await db
        .insert(suppressionList)
        .values({
          accountId: payload.accountId,
          email: payload.recipient,
          reason: 'hard_bounce',
          dsnCode: payload.dsnCode,
        })
        .onConflictDoNothing();
    }

    return reply.status(200).send({ success: true });
  });
}
