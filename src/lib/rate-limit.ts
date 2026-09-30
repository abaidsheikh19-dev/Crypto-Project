import 'server-only';
import { createHash } from 'node:crypto';
import { db } from './db';

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  adminLogin: { limit: 10, windowSeconds: 15 * 60 },
  adminMfa: { limit: 10, windowSeconds: 15 * 60 },
  discountCode: { limit: 10, windowSeconds: 10 * 60 },
  checkout: { limit: 20, windowSeconds: 10 * 60 },
  webhook: { limit: 120, windowSeconds: 60 },
  cart: { limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * Fixed-window counter stored in Postgres, so it holds across serverless
 * instances. Returns true when the request is allowed.
 */
export async function consumeRateLimit(bucket: keyof typeof RATE_LIMITS, identifier: string): Promise<boolean> {
  const rule = RATE_LIMITS[bucket];
  const key = createHash('sha256').update(`${bucket}:${identifier}`).digest('hex');
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${rule.windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
    RETURNING count`;
  return (rows[0]?.count ?? 0) <= rule.limit;
}
