// Test-only server for Playwright: a throwaway PostgreSQL, migrated and seeded,
// then the production build via `next start`. Never used for real data.
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const dbPort = 54349;
const appPort = Number(process.env.E2E_PORT ?? 3100);
const url = `postgresql://postgres:postgres@localhost:${dbPort}/store_e2e`;
const dir = mkdtempSync(path.join(tmpdir(), 'store-e2e-db-'));
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: dbPort, persistent: false, onLog: () => {} });

await pg.initialise();
await pg.start();
await pg.createDatabase('store_e2e');

const env = {
  ...process.env,
  NODE_ENV: 'production',
  DATABASE_URL: url,
  DATABASE_URL_UNPOOLED: url,
  APP_MASTER_KEY: Buffer.alloc(32, 9).toString('base64'),
  APP_URL: `http://localhost:${appPort}`,
  ADMIN_EMAIL: 'owner@e2e.test',
  ADMIN_PASSWORD: 'e2e-owner-password-1234',
  CRON_SECRET: randomBytes(24).toString('base64url'),
  PAYMENTS_MODE: 'demo',
  RESEND_API_KEY: '',
  BTCPAY_URL: '',
};
execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env, stdio: 'inherit' });
execFileSync('node', ['prisma/seed.mjs'], { env, stdio: 'inherit' });

const app = spawn('npx', ['next', 'start', '-p', String(appPort)], { env, stdio: 'inherit' });
const stop = async () => {
  app.kill('SIGTERM');
  await pg.stop();
  rmSync(dir, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
app.on('exit', stop);
