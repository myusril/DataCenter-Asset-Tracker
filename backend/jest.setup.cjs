// Runs before every test file. Points Prisma at the dedicated test database so
// no suite can ever touch the development database named in backend/.env.
//
// This file is CommonJS on purpose: Jest loads `setupFiles` before the TS/ESM
// transform, so an ESM `.mjs` setup file fails with "Cannot use import
// statement outside a module" and every suite aborts before running.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

process.env.NODE_ENV = 'test';

// Parse backend/.env directly: Jest's sandboxed `process` does not expose
// `loadEnvFile`. DATABASE_URL always comes from this file so it cannot diverge
// from the URL that scripts/test-db.sh prepares.
let envFile;
try {
  envFile = readFileSync(resolve(__dirname, '.env'), 'utf8');
} catch {
  throw new Error(
    'backend/.env is required for tests. Copy backend/.env.example to backend/.env, ' +
      'then run `npm run test:db:prepare`.',
  );
}

for (const line of envFile.split(/\r?\n/)) {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
  if (!match) {
    continue;
  }
  const key = match[1];
  let value = match[2] ?? '';
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (key !== undefined && (process.env[key] === undefined || key === 'DATABASE_URL')) {
    process.env[key] = value;
  }
}

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  throw new Error('DATABASE_URL is missing from backend/.env');
}

let url;
try {
  url = new URL(baseUrl);
} catch {
  // Never forward the raw value: it contains the database password.
  throw new Error('DATABASE_URL in backend/.env is not a valid URL');
}
if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
  throw new Error('DATABASE_URL must be a PostgreSQL URL');
}
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
  throw new Error('The test database must run on localhost or 127.0.0.1');
}
if (url.pathname === '/datacenter_tracker_test') {
  throw new Error('backend/.env must point at the development database, not the test database');
}

// The Jest suites share one schema and truncate between suites, so the worker
// pool is pinned to a single process in jest.config.mjs.
url.pathname = '/datacenter_tracker_test';
process.env.DATABASE_URL = url.toString();
