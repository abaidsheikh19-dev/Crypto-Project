'use server';

import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/src/lib/db';
import { paymentsMode } from '@/src/lib/env';
import { randomToken } from '@/src/lib/crypto';
import { demoProvider } from '@/src/lib/payments/demo';
import { handlePaymentWebhook, signBody } from '@/src/lib/payments/webhook';

const schema = z.object({
  invoiceId: z.string().regex(/^demo_[A-Za-z0-9_-]{16}$/),
  outcome: z.enum(['Processing', 'Settled', 'Expired']),
});

const EVENT_FOR: Record<z.infer<typeof schema>['outcome'], string> = {
  Processing: 'InvoiceProcessing',
  Settled: 'InvoiceSettled',
  Expired: 'InvoiceExpired',
};

/**
 * Demo only: plays the part of BTCPay Server. It changes the mock invoice,
 * then delivers a signed webhook through exactly the same verification,
 * idempotency and re-fetch path that real BTCPay webhooks go through.
 */
export async function simulatePayment(formData: FormData) {
  if (paymentsMode() !== 'demo') notFound();
  const parsed = schema.safeParse({ invoiceId: formData.get('invoiceId'), outcome: formData.get('outcome') });
  if (!parsed.success) notFound();
  const { invoiceId, outcome } = parsed.data;

  const provider = demoProvider();
  const current = await provider.getInvoice(invoiceId);
  if (!current) notFound();
  if (current.status !== 'New' && !(current.status === 'Processing' && outcome === 'Settled')) {
    redirect(`/pay/demo/${invoiceId}`);
  }

  await db.mockInvoice.update({ where: { id: invoiceId }, data: { status: outcome } });
  const body = JSON.stringify({
    deliveryId: randomToken(16),
    webhookId: 'demo',
    isRedelivery: false,
    type: EVENT_FOR[outcome],
    timestamp: Math.floor(Date.now() / 1000),
    storeId: 'demo-store',
    invoiceId,
  });
  await handlePaymentWebhook(body, signBody(body, provider.webhookSecret()), provider);

  if (outcome === 'Settled') {
    const invoice = await db.mockInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    redirect(invoice.redirectUrl);
  }
  redirect(`/pay/demo/${invoiceId}`);
}
