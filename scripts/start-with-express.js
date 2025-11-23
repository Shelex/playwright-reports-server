const { cpSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawn } = require('node:child_process');

// detect environment: Docker (standalone at root) vs local (standalone in .next/)
const isDocker = existsSync('server.js') && existsSync(join('server', 'express-server.js'));
const baseDir = isDocker ? '.' : join('.next', 'standalone');

console.log(`[startup] Environment: ${isDocker ? 'Docker' : 'Local development'}`);
console.log(`[startup] Base directory: ${baseDir}`);

// Validation
if (!isDocker) {
  if (!existsSync(join('.next', 'standalone'))) {
    console.error('[startup] Error: Next.js build not found!');
    console.error('[startup] Please run the following commands first:');
    console.error('[startup]   npm run build:next');
    console.error('[startup]   npm run build:express');
    console.error('[startup] Or: npm run build');
    process.exit(1);
  }

  if (!existsSync(join('.next', 'standalone', 'server', 'express-server.js'))) {
    console.error('[startup] Error: Express server build not found!');
    console.error('[startup] Please run: npm run build:express');
    process.exit(1);
  }

  function copyDir(src, dest) {
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true, force: true });
    } else {
      console.warn(`[startup] Warning: ${src} not found, skipping copy`);
    }
  }

  copyDir(join('.next', 'static'), join('.next', 'standalone', '.next', 'static'));
  copyDir('public', join('.next', 'standalone', 'public'));
}

const NEXT_PORT = process.env.NEXT_PORT || 3001;
const EXPRESS_PORT = process.env.PORT || 3000;

console.log('[startup] Starting Next.js standalone server...');

const nextServer = spawn('node', [join(baseDir, 'server.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: NEXT_PORT.toString(),
  },
});

nextServer.on('error', (error) => {
  console.error('[startup] Failed to start Next.js server:', error);
  process.exit(1);
});

setTimeout(() => {
  console.log('[startup] Starting Express proxy server...');

  const expressServer = spawn('node', [join(baseDir, 'server', 'express-server.js')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: EXPRESS_PORT.toString(),
      NEXT_PORT: NEXT_PORT.toString(),
    },
  });

  expressServer.on('error', (error) => {
    console.error('[startup] Failed to start Express server:', error);
    nextServer.kill();
    process.exit(1);
  });

  expressServer.on('close', (code) => {
    console.log('[startup] Express server closed with code:', code);
    nextServer.kill();
    process.exit(code || 0);
  });
}, 2000);

nextServer.on('close', (code) => {
  console.log('[startup] Next.js server closed with code:', code);
  process.exit(code || 0);
});

process.on('SIGTERM', () => {
  console.log('[startup] SIGTERM received, shutting down...');
  nextServer.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[startup] SIGINT received, shutting down...');
  nextServer.kill('SIGINT');
  process.exit(0);
});
