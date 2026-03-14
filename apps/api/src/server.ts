import Fastify from 'fastify';
import cors from '@fastify/cors';
import { harakaWebhookRoutes } from './routes/webhooks/haraka.js';
import { dkimLookupRoutes } from './routes/domains/dkim-lookup.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(harakaWebhookRoutes);
  await app.register(dkimLookupRoutes);

  return app;
}

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API server running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
