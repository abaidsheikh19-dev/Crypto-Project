// Prints fresh random values to paste into Vercel's environment variables (or .env).
// Nothing is written to disk. Keep APP_MASTER_KEY safe: losing it makes stored
// personal data unreadable, and changing it needs the rotation steps in docs/operations.md.
import { randomBytes } from 'node:crypto';

console.log(`APP_MASTER_KEY=${randomBytes(32).toString('base64')}`);
console.log(`CRON_SECRET=${randomBytes(24).toString('base64url')}`);
