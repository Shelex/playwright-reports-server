import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { config } from 'dotenv';
import Fastify from 'fastify';
import { lifecycle } from './lib/service/lifecycle.js';
import { registerApiRoutes } from './routes/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: join(__dirname, '../../../.env') });

const PORT = Number.parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const AUTH_SECRET = process.env.AUTH_SECRET || 'development-secret-change-in-production';

async function start() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await fastify.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });

  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: AUTH_SECRET,
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  await fastify.register(fastifyMultipart);

  fastify.get('/api/ping', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/api/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  });

  await registerApiRoutes(fastify);

  const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
  await fastify.register(fastifyStatic, {
    root: dataDir,
    prefix: '/data/',
    decorateReply: false,
  });

  if (process.env.NODE_ENV === 'production') {
    const frontendDistPath =
      process.env.FRONTEND_DIST || join(process.cwd(), '..', '..', 'apps', 'frontend', 'dist');

    await fastify.register(fastifyStatic, {
      root: frontendDistPath,
      decorateReply: true,
    });

    // spa fallback for non-api routes
    fastify.setNotFoundHandler(async (request, reply) => {
      if (!request.url.startsWith('/api') && !request.url.startsWith('/data')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'Not Found' });
    });
  }

  console.log('[server] Initializing databases and services...');
  await lifecycle.initialize();
  console.log('[server] Initialization complete');

  const closeGracefully = async (signal: string) => {
    fastify.log.info(`Received signal to terminate: ${signal}`);
    await lifecycle.cleanup();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', () => closeGracefully('SIGINT'));
  process.on('SIGTERM', () => closeGracefully('SIGTERM'));

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

await start();
