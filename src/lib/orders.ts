import 'server-only';
import type { OrderStatus } from '@prisma/client';
import { db, type Tx } from './db';
import { decrypt, decryptOptional, encrypt, hashToken, orderNumber, randomToken } from './crypto';
import { audit } from './audit';
import { calculateTotals, type PromotionRule } from './pricing';
import { getSettings } from './settings';
import { enqueueEmail, paymentConfirmedEmail, processOutbox } from './email';
import { activeProvider, providerByName } from './payments';
import type { InvoiceStatus } from './payments/types';
import type { CheckoutDetails } from './validators';
import { appUrl } from './env';
import { errorName, log } from './log';

export const FINAL_STATUSES: OrderStatus[] = ['shipped', 'cancelled', 'refunded'];
const OPEN_PAYMENT_STATUSES: OrderStatus[] = ['pending_payment', 'payment_detected'];

export type CheckoutErrorCode = 'empty_cart' | 'out_of_stock' | 'code_invalid' | 'payment_unavailable';

export class CheckoutError extends Error {
  constructor(
    public readonly code: CheckoutErrorCode,
    public readonly productName?: string,
  ) {
    super(code);
    this.name = 'CheckoutError';
  }
}

export function statusUrl(token: string, origin = appUrl()): string {
  return `${origin}/status/${token}`;
}

/**
 * Turn a cart into an order. Everything is re-priced from the database inside
 * one transaction; stock is decremented with a conditional UPDATE so two
 * buyers can never both take the last unit; the discount code's usage limit
 * is enforced the same way.
 */
export async function placeOrder(input: { cartId: number; details: CheckoutDetails; origin: string }) {
  await expireStaleReservations().catch((error) => log('warn', 'reservations.sweep_failed', { error: errorName(error) }));

  const settings = await getSettings();
  const provider = activeProvider();
  const token = randomToken();
  const now = new Date();

  const order = await db.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { id: input.cartId },
      include: { discountCode: true, items: { include: { product: { include: { promotions: { where: { isActive: true } } } } } } },
    });
    const items = (cart?.items ?? []).filter((item) => item.product.isActive).sort((a, b) => a.productId - b.productId);
    if (!cart || items.length === 0) throw new CheckoutError('empty_cart');

    const totals = calculateTotals({
      items: items.map((item) => ({ productId: item.productId, name: item.product.name, unitPriceCents: item.product.priceCents, quantity: item.qty })),
      promotions: items.flatMap((item) => item.product.promotions as PromotionRule[]),
      code: cart.discountCode,
      shipping: { flatCents: settings.shipping_flat_cents, freeThresholdCents: settings.free_shipping_threshold_cents },
      now,
    });
    if (cart.discountCode && totals.codeStatus !== 'applied') throw new CheckoutError('code_invalid');

    // Reserve stock. Sorted by product ID so concurrent checkouts lock rows in the same order.
    for (const item of items) {
      const reserved = await tx.product.updateMany({
        where: { id: item.productId, isActive: true, stockQty: { gte: item.qty } },
        data: { stockQty: { decrement: item.qty } },
      });
      if (reserved.count !== 1) throw new CheckoutError('out_of_stock', item.product.name);
    }

    if (cart.discountCode) {
      const redeemed = await tx.discountCode.updateMany({
        where: {
          id: cart.discountCode.id,
          isActive: true,
          OR: [{ maxUses: null }, { usedCount: { lt: db.discountCode.fields.maxUses } }],
        },
        data: { usedCount: { increment: 1 } },
      });
      if (redeemed.count !== 1) throw new CheckoutError('code_invalid');
    }

    const expiresAt = new Date(now.getTime() + settings.reservation_minutes * 60_000);
    const d = input.details;
    const created = await tx.order.create({
      data: {
        orderNumber: orderNumber(),
        publicTokenHash: hashToken(token),
        publicTokenEnc: encrypt(token),
        status: 'pending_payment',
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        shippingCents: totals.shippingCents,
        totalCents: totals.totalCents,
        discountCodeId: totals.codeStatus === 'applied' ? cart.discountCode!.id : null,
        emailEnc: encrypt(d.email),
        nameEnc: encrypt(d.name),
        addressLine1Enc: encrypt(d.addressLine1),
        addressLine2Enc: d.addressLine2 ? encrypt(d.addressLine2) : null,
        cityEnc: encrypt(d.city),
        regionEnc: d.region ? encrypt(d.region) : null,
        postcodeEnc: encrypt(d.postcode),
        countryEnc: encrypt(d.country),
        paymentProvider: provider.name,
        items: {
          create: totals.lines.map((line) => ({
            productId: line.productId,
            productNameSnapshot: line.name,
            unitPriceCents: line.saleUnitPriceCents,
            qty: line.quantity,
          })),
        },
        reservations: { create: totals.lines.map((line) => ({ productId: line.productId, qty: line.quantity, expiresAt })) },
      },
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { discountCodeId: null, checkoutDraftEnc: null } });
    await audit({ type: 'system' }, 'order.created', { type: 'order', id: created.id }, { totalCents: created.totalCents, provider: provider.name }, { tx });
    return created;
  });

  try {
    const invoice = await provider.createInvoice({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountCents: order.totalCents,
      redirectUrl: statusUrl(token, input.origin),
      expirationMinutes: settings.reservation_minutes,
    });
    await db.order.update({ where: { id: order.id }, data: { invoiceId: invoice.invoiceId } });
    return { orderId: order.id, token, checkoutUrl: invoice.checkoutUrl };
  } catch (error) {
    log('error', 'payments.create_invoice_failed', { orderId: order.id, error: errorName(error) });
    await applyInvoiceStatus(order.id, 'Invalid', 'invoice_creation_failed');
    throw new CheckoutError('payment_unavailable');
  }
}

/** Return reserved stock (and a discount code use) for an order that will not be paid. */
async function releaseOrder(tx: Tx, orderId: number, discountCodeId: number | null) {
  const now = new Date();
  const reservations = await tx.stockReservation.findMany({ where: { orderId, releasedAt: null, consumedAt: null } });
  for (const reservation of reservations) {
    const released = await tx.stockReservation.updateMany({
      where: { id: reservation.id, releasedAt: null, consumedAt: null },
      data: { releasedAt: now },
    });
    if (released.count === 1) {
      await tx.product.update({ where: { id: reservation.productId }, data: { stockQty: { increment: reservation.qty } } });
    }
  }
  if (discountCodeId) {
    await tx.discountCode.updateMany({ where: { id: discountCodeId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
  }
}

/**
 * Move an order forward based on the provider's invoice status. Transitions
 * are conditional updates, so replays and races are harmless.
 */
export async function applyInvoiceStatus(orderId: number, invoiceStatus: InvoiceStatus, source: string): Promise<OrderStatus | null> {
  let sendConfirmation = false;
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return null;
    const now = new Date();

    if (invoiceStatus === 'Settled') {
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: { in: OPEN_PAYMENT_STATUSES } },
        data: { status: 'paid', paidAt: now },
      });
      if (moved.count === 1) {
        await tx.stockReservation.updateMany({ where: { orderId, releasedAt: null, consumedAt: null }, data: { consumedAt: now } });
        await queueConfirmation(tx, orderId);
        sendConfirmation = true;
        await audit({ type: 'system' }, 'order.status_changed', { type: 'order', id: orderId }, { from: order.status, to: 'paid', source }, { tx });
        return 'paid' as const;
      }
      if (order.status === 'cancelled') {
        // Paid after the invoice was treated as expired: stock was already released.
        await tx.order.update({ where: { id: orderId }, data: { needsReview: true } });
        await audit({ type: 'system' }, 'order.late_payment', { type: 'order', id: orderId }, { source }, { tx });
      }
      return order.status;
    }

    if (invoiceStatus === 'Processing') {
      const moved = await tx.order.updateMany({ where: { id: orderId, status: 'pending_payment' }, data: { status: 'payment_detected' } });
      if (moved.count === 1) {
        await audit({ type: 'system' }, 'order.status_changed', { type: 'order', id: orderId }, { from: order.status, to: 'payment_detected', source }, { tx });
        return 'payment_detected' as const;
      }
      return order.status;
    }

    if (invoiceStatus === 'Expired' || invoiceStatus === 'Invalid') {
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: { in: OPEN_PAYMENT_STATUSES } },
        data: { status: 'cancelled', closedAt: now },
      });
      if (moved.count === 1) {
        await releaseOrder(tx, orderId, order.discountCodeId);
        await audit({ type: 'system' }, 'order.status_changed', { type: 'order', id: orderId }, { from: order.status, to: 'cancelled', source, invoiceStatus }, { tx });
        return 'cancelled' as const;
      }
      return order.status;
    }

    return order.status;
  });

  if (sendConfirmation) await processOutbox().catch((error) => log('warn', 'email.outbox_failed', { error: errorName(error) }));
  return result;
}

async function queueConfirmation(tx: Tx, orderId: number) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order?.emailEnc) return;
  const token = decryptOptional(order.publicTokenEnc);
  await enqueueEmail(
    paymentConfirmedEmail({
      to: decrypt(order.emailEnc),
      orderNumber: order.orderNumber,
      items: order.items.map((item) => ({ name: item.productNameSnapshot, qty: item.qty, unitPriceCents: item.unitPriceCents })),
      totalCents: order.totalCents,
      statusUrl: token ? statusUrl(token) : appUrl(),
    }),
    { orderId, tx },
  );
}

/**
 * Fallback for missed webhooks: for unpaid orders whose reservation has run
 * out, ask the payment provider for the invoice status and apply it.
 */
export async function expireStaleReservations(now = new Date()): Promise<{ checked: number; cancelled: number }> {
  const stale = await db.order.findMany({
    where: {
      status: 'pending_payment',
      reservations: { some: { expiresAt: { lte: now }, releasedAt: null, consumedAt: null } },
    },
    select: { id: true, invoiceId: true, paymentProvider: true },
    take: 50,
  });

  let cancelled = 0;
  for (const order of stale) {
    try {
      let status: InvoiceStatus = 'Expired';
      if (order.invoiceId) {
        const invoice = await providerByName(order.paymentProvider).getInvoice(order.invoiceId);
        status = invoice?.status ?? 'Expired';
      }
      const next = await applyInvoiceStatus(order.id, status, 'reservation_sweep');
      if (next === 'cancelled') cancelled++;
    } catch (error) {
      log('warn', 'reservations.check_failed', { orderId: order.id, error: errorName(error) });
    }
  }
  return { checked: stale.length, cancelled };
}

/** Public order status view. Never includes the address or email. */
export async function getOrderByPublicToken(token: string) {
  return db.order.findUnique({
    where: { publicTokenHash: hashToken(token) },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotalCents: true,
      discountCents: true,
      shippingCents: true,
      totalCents: true,
      trackingNumber: true,
      invoiceId: true,
      paymentProvider: true,
      createdAt: true,
      paidAt: true,
      shippedAt: true,
      items: { select: { id: true, productNameSnapshot: true, unitPriceCents: true, qty: true } },
      reservations: { select: { expiresAt: true }, take: 1 },
    },
  });
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  payment_detected: 'Payment detected',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/**
 * Pull the latest invoice status for an unpaid order (used when a customer
 * views their status page, in case a webhook was delayed or missed).
 */
export async function syncOrderWithProvider(order: { id: number; status: OrderStatus; invoiceId: string | null; paymentProvider: string }) {
  if (!OPEN_PAYMENT_STATUSES.includes(order.status) || !order.invoiceId) return order.status;
  try {
    const invoice = await providerByName(order.paymentProvider).getInvoice(order.invoiceId);
    if (!invoice || invoice.status === 'New') return order.status;
    return (await applyInvoiceStatus(order.id, invoice.status, 'status_page_sync')) ?? order.status;
  } catch (error) {
    log('warn', 'payments.sync_failed', { orderId: order.id, error: errorName(error) });
    return order.status;
  }
}
