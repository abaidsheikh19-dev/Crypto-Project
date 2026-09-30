// Starts a real PostgreSQL server for local development without Docker.
// Data lives in ./.local-db (git-ignored). Stop with Ctrl+C.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const port = Number(process.env.LOCAL_DB_PORT ?? 54329);
const dir = './.local-db';
const fresh = !existsSync(dir);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: true, onLog: () => {} });

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('store');
console.log(`Postgres running: postgresql://postgres:postgres@localhost:${port}/store`);
console.log('Press Ctrl+C to stop.');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
