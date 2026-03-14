import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@email-platform/database';
import { sendingDomains } from '@email-platform/database/schema';
import { eq, and } from 'drizzle-orm';

const querySchema = z.object({
  domain: z.string().min(1),
});

export async function dkimLookupRoutes(fastify: FastifyInstance) {
  // Internal endpoint — called by Haraka's custom_dkim_sign plugin
  // Only accessible within the Docker network (not exposed to internet)
  fastify.get('/internal/dkim-lookup', async (request, reply) => {
    // Validate the query parameter
    const result = querySchema.safeParse(request.query);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Missing domain parameter',
      });
    }

    const { domain } = result.data;

    // Find a verified domain record with its DKIM key
    const record = await db.query.sendingDomains.findFirst({
      where: and(
        eq(sendingDomains.domain, domain),
        eq(sendingDomains.status, 'verified'),
      ),
      columns: {
        dkimSelector: true,
        dkimPrivateKey: true,
        domain: true,
      },
    });

    if (!record) {
      return reply.status(404).send({
        success: false,
        error: 'Domain not found or not verified',
      });
    }

    // Return the DKIM data to Haraka
    return reply.send({
      success: true,
      data: {
        domain: record.domain,
        selector: record.dkimSelector,
        privateKey: record.dkimPrivateKey,
      },
    });
  });
}
