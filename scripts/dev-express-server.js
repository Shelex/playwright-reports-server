#!/usr/bin/env node
const { register } = require('ts-node');
const tsConfigPaths = require('tsconfig-paths');

const tsConfig = require('../tsconfig.json');
tsConfigPaths.register({
  baseUrl: './',
  paths: tsConfig.compilerOptions.paths,
});

register({
  project: './server/tsconfig.json',
  transpileOnly: true,
});

const { startExpressServer } = require('../server/express-server.ts');

startExpressServer();
