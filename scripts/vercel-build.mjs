// Vercel runs `npm run vercel-build` instead of `build` when this script exists.
// It applies database migrations and the idempotent seed before building, so a
// fresh Neon database becomes a working store on the first deploy.
import { spawnSync } from 'node:child_process';

const missing = ['DATABASE_URL', 'APP_MASTER_KEY'].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`\n✖ Missing environment variables: ${missing.join(', ')}`);
  console.error('  Vercel → Project → Storage: connect a Neon database (sets DATABASE_URL).');
  console.error('  Vercel → Project → Settings → Environment Variables: add APP_MASTER_KEY (run `npm run gen:secrets`).');
  console.error('  See README.md → "Deploy to Vercel".\n');
  process.exit(1);
}
if (Buffer.from(process.env.APP_MASTER_KEY, 'base64').length !== 32) {
  console.error('\n✖ APP_MASTER_KEY must be 32 random bytes, base64-encoded. Generate one with `npm run gen:secrets`.\n');
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL };

function run(command, args) {
  console.log(`\n▶ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npx', ['prisma', 'generate']);
run('npx', ['prisma', 'migrate', 'deploy']);
run('node', ['prisma/seed.mjs']);
run('npx', ['next', 'build']);
