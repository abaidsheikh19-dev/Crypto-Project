import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { TEST_DATABASE_URL, TEST_DB_PORT } from './constants';

// Starts a disposable PostgreSQL, applies the real migrations, and removes it afterwards.
export default async function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), 'store-test-db-'));
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: TEST_DB_PORT, persistent: false, onLog: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('store_test');
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DATABASE_URL_UNPOOLED: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
  return async () => {
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
