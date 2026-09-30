import { NextResponse } from 'next/server';
import { env } from '@/src/lib/env';
import { safeEqual } from '@/src/lib/crypto';
import { runDailyJobs } from '@/src/server/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily maintenance, called by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. Runs the reservation fallback, email
 * retries and the retention purge.
 */
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await runDailyJobs();
  return NextResponse.json({ ok: true, ...result });
}
