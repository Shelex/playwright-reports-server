import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { handleUpload } from './upload-handler';

const NEXT_PORT = process.env.NEXT_PORT || 3001;
const EXPRESS_PORT = process.env.PORT || 3000;

export function createExpressServer() {
  const app = express();

  app.get('/api/health', (_, res) => {
    res.json({ status: 'ok', server: 'express' });
  });

  app.put('/api/result/upload', handleUpload);

  app.use(
    '/',
    createProxyMiddleware({
      target: `http://localhost:${NEXT_PORT}`,
      changeOrigin: true,
      ws: true,
      logger: console,
    }),
  );

  return app;
}

export function startExpressServer() {
  const app = createExpressServer();

  const server = app.listen(EXPRESS_PORT, () => {
    console.log(`[express] Server listening on port ${EXPRESS_PORT}`);
    console.log(`[express] Upload endpoint: http://localhost:${EXPRESS_PORT}/api/result/upload`);
    console.log(`[express] Proxying other requests to Next.js on port ${NEXT_PORT}`);
  });

  process.on('SIGTERM', () => {
    console.log('[express] SIGTERM received, closing server...');
    server.close(() => {
      console.log('[express] Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[express] SIGINT received, closing server...');
    server.close(() => {
      console.log('[express] Server closed');
      process.exit(0);
    });
  });

  return server;
}

if (require.main === module) {
  startExpressServer();
}
