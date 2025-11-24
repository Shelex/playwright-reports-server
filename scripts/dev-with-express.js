const { spawn } = require('node:child_process');

const NEXT_PORT = process.env.NEXT_PORT || 3001;
const EXPRESS_PORT = process.env.PORT || 3000;

console.log('[dev] Starting Next.js dev server...');

const nextServer = spawn('npm', ['run', 'dev:next'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: NEXT_PORT.toString(),
  },
  shell: true,
});

nextServer.on('error', (error) => {
  console.error('[dev] Failed to start Next.js server:', error);
  process.exit(1);
});

setTimeout(() => {
  console.log('[dev] Starting Express proxy server...');

  const expressServer = spawn('npm', ['run', 'dev:express'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: EXPRESS_PORT.toString(),
      NEXT_PORT: NEXT_PORT.toString(),
    },
    shell: true,
  });

  expressServer.on('error', (error) => {
    console.error('[dev] Failed to start Express server:', error);
    nextServer.kill();
    process.exit(1);
  });

  expressServer.on('close', (code) => {
    console.log('[dev] Express server closed with code:', code);
    nextServer.kill();
    process.exit(code || 0);
  });
}, 3000);

nextServer.on('close', (code) => {
  console.log('[dev] Next.js server closed with code:', code);
  process.exit(code || 0);
});

process.on('SIGTERM', () => {
  console.log('[dev] SIGTERM received, shutting down...');
  nextServer.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[dev] SIGINT received, shutting down...');
  nextServer.kill('SIGINT');
  process.exit(0);
});
