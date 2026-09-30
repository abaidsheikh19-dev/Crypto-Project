import { NextResponse } from 'next/server';
import { db } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

/** Uptime check. Reports only whether the app and database answer. */
export async function GET() {
  let database = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  return NextResponse.json(
    { status: database ? 'ok' : 'degraded', database, time: new Date().toISOString() },
    { status: database ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
