import 'server-only';
import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '../db';
import { safeEqual } from '../crypto';
import { applyInvoiceStatus } from '../orders';
import { errorName, log } from '../log';
import type { PaymentProvider } from './types';

export const MAX_WEBHOOK_BYTES = 64 * 1024;

const HANDLED_EVENTS = new Set(['InvoiceSettled', 'InvoiceProcessing', 'InvoiceExpired', 'InvoiceInvalid', 'InvoicePaymentSettled']);

const payloadSchema = z.object({
  deliveryId: z.string().min(1).max(200),
  originalDeliveryId: z.string().min(1).max(200).optional(),
  type: z.string().min(1).max(100),
  invoiceId: z.string().min(1).max(200).optional(),
  storeId: z.string().max(200).optional(),
  timestamp: z.number().optional(),
});

export function signBody(rawBody: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
}

/** Constant-time check of BTCPay's `BTCPay-Sig: sha256=<hex>` header. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !/^sha256=[0-9a-f]{64}$/i.test(header) || !secret) return false;
  return safeEqual(signBody(rawBody, secret), header.toLowerCase());
}

export type WebhookResult = { status: number; body: Record<string, string | boolean> };

/**
 * Shared by the public webhook route and the demo payment simulator.
 * The payload is only a hint: the invoice is re-fetched from the provider
 * and its authoritative status is what changes the order.
 */
export async function handlePaymentWebhook(rawBody: string, signature: string | null, provider: PaymentProvider): Promise<WebhookResult> {
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES) return { status: 413, body: { ok: false } };
  if (!verifySignature(rawBody, signature, provider.webhookSecret())) return { status: 401, body: { ok: false } };

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(rawBody));
  } catch {
    return { status: 400, body: { ok: false } };
  }

  const eventId = `${provider.name}:${payload.originalDeliveryId ?? payload.deliveryId}`;
  try {
    await db.webhookEvent.create({ data: { provider: provider.name, eventId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { status: 200, body: { ok: true, duplicate: true } };
    }
    throw error;
  }

  if (!HANDLED_EVENTS.has(payload.type) || !payload.invoiceId) {
    return { status: 200, body: { ok: true, ignored: true } };
  }

  try {
    const invoice = await provider.getInvoice(payload.invoiceId);
    const order = invoice ? await db.order.findUnique({ where: { invoiceId: invoice.id }, select: { id: true } }) : null;
    if (!invoice || !order || invoice.orderId !== order.id) {
      log('warn', 'webhook.unknown_invoice', { provider: provider.name });
      return { status: 200, body: { ok: true, ignored: true } };
    }
    await applyInvoiceStatus(order.id, invoice.status, `webhook:${payload.type}`);
    return { status: 200, body: { ok: true } };
  } catch (error) {
    // Forget the event so the provider's retry is processed.
    await db.webhookEvent.deleteMany({ where: { eventId } });
    log('error', 'webhook.processing_failed', { provider: provider.name, error: errorName(error) });
    return { status: 500, body: { ok: false } };
  }
}
