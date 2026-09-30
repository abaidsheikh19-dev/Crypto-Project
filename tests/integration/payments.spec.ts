import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/db';
import { decrypt, randomToken } from '../../src/lib/crypto';
import { expireStaleReservations, placeOrder } from '../../src/lib/orders';
import { demoProvider } from '../../src/lib/payments/demo';
import { handlePaymentWebhook, signBody } from '../../src/lib/payments/webhook';
import { details, makeCart, makeProduct, resetDb } from '../support/factories';

const provider = demoProvider();

function event(invoiceId: string, type: string, deliveryId = randomToken(12)) {
  return JSON.stringify({ deliveryId, webhookId: 'w', isRedelivery: false, type, timestamp: 1, storeId: 's', invoiceId });
}
const signed = (body: string) => signBody(body, provider.webhookSecret());

async function checkout(opts: { stockQty?: number; qty?: number; codeId?: number } = {}) {
  const product = await makeProduct({ stockQty: opts.stockQty ?? 5, priceCents: 1000 });
  const cart = await makeCart([{ productId: product.id, qty: opts.qty ?? 2 }], opts.codeId);
  const result = await placeOrder({ cartId: cart.id, details, origin: 'https://shop.test' });
  const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
  return { product, order, invoiceId: order.invoiceId!, token: result.token };
}

const stock = async (id: number) => (await db.product.findUniqueOrThrow({ where: { id } })).stockQty;
const status = async (id: number) => (await db.order.findUniqueOrThrow({ where: { id } })).status;

describe('payment webhooks', () => {
  beforeEach(resetDb);

  it('marks the order paid only after re-fetching a settled invoice, then queues the confirmation email', async () => {
    const { order, invoiceId, product, token } = await checkout();
    await db.mockInvoice.update({ where: { id: invoiceId }, data: { status: 'Settled' } });

    const body = event(invoiceId, 'InvoiceSettled');
    const result = await handlePaymentWebhook(body, signed(body), provider);

    expect(result.status).toBe(200);
    expect(await status(order.id)).toBe('paid');
    expect(await stock(product.id)).toBe(3);
    expect(await db.stockReservation.count({ where: { orderId: order.id, consumedAt: { not: null } } })).toBe(1);
    const email = await db.emailOutbox.findFirstOrThrow({ where: { orderId: order.id } });
    expect(email.status).toBe('CAPTURED'); // no provider configured in tests
    expect(decrypt(email.toEnc)).toBe(details.email);
    const text = decrypt(email.bodyTextEnc);
    expect(text).toContain(order.orderNumber);
    expect(text).toContain(`https://shop.test/status/${token}`);
    expect(text).toContain('$25.00');
  });

  it('rejects forged and unsigned webhooks without changing anything', async () => {
    const { order, invoiceId } = await checkout();
    await db.mockInvoice.update({ where: { id: invoiceId }, data: { status: 'Settled' } });
    const body = event(invoiceId, 'InvoiceSettled');

    expect((await handlePaymentWebhook(body, null, provider)).status).toBe(401);
    expect((await handlePaymentWebhook(body, signBody(body, 'attacker-guess'), provider)).status).toBe(401);
    expect((await handlePaymentWebhook(body.replace('"s"', '"x"'), signed(body), provider)).status).toBe(401);
    expect(await status(order.id)).toBe('pending_payment');
    expect(await db.webhookEvent.count()).toBe(0);
  });

  it('does not trust the payload: a signed "settled" event for an unpaid invoice changes nothing', async () => {
    const { order, invoiceId } = await checkout();
    const body = event(invoiceId, 'InvoiceSettled');
    expect((await handlePaymentWebhook(body, signed(body), provider)).status).toBe(200);
    expect(await status(order.id)).toBe('pending_payment');
  });

  it('ignores replayed deliveries', async () => {
    const { order, invoiceId } = await checkout();
    await db.mockInvoice.update({ where: { id: invoiceId }, data: { status: 'Settled' } });
    const body = event(invoiceId, 'InvoiceSettled', 'delivery-1');

    await handlePaymentWebhook(body, signed(body), provider);
    const replay = await handlePaymentWebhook(body, signed(body), provider);

    expect(replay.body).toMatchObject({ duplicate: true });
    expect(await db.emailOutbox.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('rejects malformed and oversized bodies', async () => {
    const junk = 'not json';
    expect((await handlePaymentWebhook(junk, signed(junk), provider)).status).toBe(400);
    const huge = 'x'.repeat(70 * 1024);
    expect((await handlePaymentWebhook(huge, signed(huge), provider)).status).toBe(413);
  });

  it('moves to payment_detected on processing, then paid on settlement', async () => {
    const { order, invoiceId } = await checkout();
    await db.mockInvoice.update({ where: { id: invoiceId }, data: { status: 'Processing' } });
    let body = event(invoiceId, 'InvoiceProcessing');
    await handlePaymentWebhook(body, signed(body), provider);
    expect(await status(order.id)).toBe('payment_detected');

    await db.mockInvoice.update({ where: { id: invoiceId }, data: { status: 'Settled' } });
    body = event(invoiceId, 'InvoiceSettled');
    await handlePaymentWebhook(body, signed(body), provider);
    expect(await status(order.id)).toBe('paid');
  });
});

describe('invoice expiry', () => {
  beforeEach(resetDb);

  it('cancels and releases stock and the discount code use through the webhook', async () => {
    const code = await db.discountCode.create({ data: { codeNormalized: 'TEN', type: 'PERCENT', value: 10 } });
    const { order, invoiceId, product } = await checkout({ codeId: code.id });
    expect(await stock(product.id)).toBe(3);
    expect((await db.discountCode.findUniqueOrThrow({ where: { id: code.id } })).usedCount).toBe(1);

    await db.mockInvoice.update({ where: { id: invoiceId }, data: { status: 'Expired' } });
    const body = event(invoiceId, 'InvoiceExpired');
    await handlePaymentWebhook(body, signed(body), provider);

    expect(await status(order.id)).toBe('cancelled');
    expect(await stock(product.id)).toBe(5);
    expect((await db.discountCode.findUniqueOrThrow({ where: { id: code.id } })).usedCount).toBe(0);

    // A second expiry event must not release the stock twice.
    const again = event(invoiceId, 'InvoiceExpired');
    await handlePaymentWebhook(again, signed(again), provider);
    expect(await stock(product.id)).toBe(5);
  });

  it('releases stock through the scheduled fallback when the webhook never arrives', async () => {
    const { order, invoiceId, product } = await checkout();
    const past = new Date(Date.now() - 60_000);
    await db.mockInvoice.update({ where: { id: invoiceId }, data: { expiresAt: past } });
    await db.stockReservation.updateMany({ where: { orderId: order.id }, data: { expiresAt: past } });

    const result = await expireStaleReservations();

    expect(result).toEqual({ checked: 1, cancelled: 1 });
    expect(await status(order.id)).toBe('cancelled');
    expect(await stock(product.id)).toBe(5);
  });

  it('leaves orders alone while their reservation is still valid', async () => {
    const { order } = await checkout();
    expect(await expireStaleReservations()).toEqual({ checked: 0, cancelled: 0 });
    expect(await status(order.id)).toBe('pending_payment');
  });

  it('flags a payment that arrives after expiry for manual review', async () => {
    const { order, invoiceId } = await checkout();
    await db.mockInvoice.update({ where: { id: invoiceId }, data: { status: 'Expired' } });
    let body = event(invoiceId, 'InvoiceExpired');
    await handlePaymentWebhook(body, signed(body), provider);

    await db.mockInvoice.update({ where: { id: invoiceId }, data: { status: 'Settled' } });
    body = event(invoiceId, 'InvoiceSettled');
    await handlePaymentWebhook(body, signed(body), provider);

    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe('cancelled');
    expect(after.needsReview).toBe(true);
  });
});
