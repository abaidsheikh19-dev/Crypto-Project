import 'server-only';
import { expireStaleReservations } from '@/src/lib/orders';
import { processOutbox } from '@/src/lib/email';
import { runPurge } from './purge';

export async function runDailyJobs() {
  const reservations = await expireStaleReservations();
  const emails = await processOutbox(100);
  const purge = await runPurge();
  return { reservations, emails, purge };
}
