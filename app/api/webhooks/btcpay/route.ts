import { NextResponse } from 'next/server';
import { activeProvider } from '@/src/lib/payments';
import { handlePaymentWebhook, MAX_WEBHOOK_BYTES } from '@/src/lib/payments/webhook';
import { consumeRateLimit } from '@/src/lib/rate-limit';
import { clientIpHash } from '@/src/lib/request';

export const dynamic = 'force-dynamic';

/**
 * BTCPay Server webhook. The HMAC signature is verified over the raw body
 * before anything else happens; the invoice is then re-fetched from BTCPay so
 * the payload alone can never change an order.
 */
export async function POST(request: Request) {
  if (!(await consumeRateLimit('webhook', await clientIpHash()))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_WEBHOOK_BYTES) return NextResponse.json({ ok: false }, { status: 413 });

  const rawBody = await request.text();
  const result = await handlePaymentWebhook(rawBody, request.headers.get('btcpay-sig'), activeProvider());
  return NextResponse.json(result.body, { status: result.status });
}
