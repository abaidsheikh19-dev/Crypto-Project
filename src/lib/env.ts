import 'server-only';
import { z } from 'zod';

const base64Key = z
  .string()
  .refine((value) => Buffer.from(value, 'base64').length === 32, 'must be 32 random bytes, base64-encoded');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  APP_MASTER_KEY: base64Key,
  // Optional previous key, accepted for decryption only while rotating.
  APP_MASTER_KEY_PREVIOUS: base64Key.optional(),
  APP_URL: z.string().url().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  PAYMENTS_MODE: z.enum(['demo', 'btcpay']).optional(),
  BTCPAY_URL: z.string().url().optional(),
  BTCPAY_STORE_ID: z.string().optional(),
  BTCPAY_API_KEY: z.string().optional(),
  BTCPAY_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CONTACT_EMAIL: z.string().email().default('orders@example.com'),
  CRON_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  // Treat empty values (e.g. `BTCPAY_URL=`) as unset rather than invalid.
  const present = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined && value.trim() !== ''));
  const parsed = schema.safeParse(present);
  if (!parsed.success) {
    // Name the variables only; never echo their values.
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

export function paymentsMode(): 'demo' | 'btcpay' {
  const e = env();
  if (e.PAYMENTS_MODE) return e.PAYMENTS_MODE;
  return e.BTCPAY_URL && e.BTCPAY_API_KEY && e.BTCPAY_STORE_ID && e.BTCPAY_WEBHOOK_SECRET ? 'btcpay' : 'demo';
}

/** Public base URL, used only for links in emails and payment redirects. */
export function appUrl(): string {
  const e = env();
  if (e.APP_URL) return e.APP_URL.replace(/\/$/, '');
  if (e.VERCEL_ENV === 'production' && e.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export const isProduction = () => env().NODE_ENV === 'production';

/** Test hook: re-read process.env on next access. */
export function resetEnvForTests() {
  cached = undefined;
}
