const { buildSync } = require('esbuild');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

console.log('[build-server] Bundling server files with esbuild...');

try {
  mkdirSync(join('.next', 'standalone', 'server'), { recursive: true });

  buildSync({
    entryPoints: [join('server', 'express-server.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: join('.next', 'standalone', 'server', 'express-server.js'),
    external: [
      'express',
      'http-proxy-middleware',
      'busboy',
      '@aws-sdk/*',
      'better-sqlite3',
      'sharp',
      'next',
      'react',
      'react-dom',
    ],
    sourcemap: true,
    minify: false,
    logLevel: 'info',
  });

  console.log('[build-server] Server bundling complete');
} catch (error) {
  console.error('[build-server] Failed to bundle server:', error.message);
  process.exit(1);
}
