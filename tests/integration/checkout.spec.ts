import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/db';
import { CheckoutError, placeOrder } from '../../src/lib/orders';
import { details, makeCart, makeProduct, resetDb } from '../support/factories';

const origin = 'https://shop.test';

describe('placeOrder', () => {
  beforeEach(resetDb);

  it('prices from the database, reserves stock, encrypts personal data and creates a demo invoice', async () => {
    const pen = await makeProduct({ priceCents: 1500, stockQty: 5 });
    const cart = await makeCart([{ productId: pen.id, qty: 2 }]);

    const result = await placeOrder({ cartId: cart.id, details, origin });

    expect(result.checkoutUrl).toMatch(/^\/pay\/demo\/demo_/);
    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: true, reservations: true } });
    expect(order).toMatchObject({ status: 'pending_payment', subtotalCents: 3000, shippingCents: 500, totalCents: 3500, paymentProvider: 'demo' });
    expect(order.items).toMatchObject([{ productNameSnapshot: pen.name, unitPriceCents: 1500, qty: 2 }]);
    expect(order.reservations).toMatchObject([{ productId: pen.id, qty: 2, releasedAt: null, consumedAt: null }]);
    expect((await db.product.findUniqueOrThrow({ where: { id: pen.id } })).stockQty).toBe(3);
    expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(0);
    expect(order.publicTokenHash).not.toContain(result.token);
  });

  it('ignores anything but current database prices (price tampering has no effect)', async () => {
    const pen = await makeProduct({ priceCents: 1500 });
    const cart = await makeCart([{ productId: pen.id, qty: 1 }]);
    // The client never sends prices; if the price changes, checkout uses the new one.
    await db.product.update({ where: { id: pen.id }, data: { priceCents: 2000 } });
    const { orderId } = await placeOrder({ cartId: cart.id, details, origin });
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).subtotalCents).toBe(2000);
  });

  it('refuses quantities above stock and changes nothing', async () => {
    const pen = await makeProduct({ stockQty: 2 });
    const cart = await makeCart([{ productId: pen.id, qty: 3 }]);
    await expect(placeOrder({ cartId: cart.id, details, origin })).rejects.toMatchObject({ code: 'out_of_stock' });
    expect((await db.product.findUniqueOrThrow({ where: { id: pen.id } })).stockQty).toBe(2);
    expect(await db.order.count()).toBe(0);
    expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(1);
  });

  it('rejects empty carts and inactive products', async () => {
    const hidden = await makeProduct();
    await db.product.update({ where: { id: hidden.id }, data: { isActive: false } });
    const cart = await makeCart([{ productId: hidden.id, qty: 1 }]);
    await expect(placeOrder({ cartId: cart.id, details, origin })).rejects.toBeInstanceOf(CheckoutError);
  });

  it('never oversells the last unit when two customers check out at the same time', async () => {
    const last = await makeProduct({ stockQty: 1 });
    const carts = await Promise.all([makeCart([{ productId: last.id, qty: 1 }]), makeCart([{ productId: last.id, qty: 1 }])]);

    const results = await Promise.allSettled(carts.map((cart) => placeOrder({ cartId: cart.id, details, origin })));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: 'out_of_stock' });
    expect((await db.product.findUniqueOrThrow({ where: { id: last.id } })).stockQty).toBe(0);
    expect(await db.order.count()).toBe(1);
  });

  it('enforces a discount code usage limit atomically', async () => {
    const pen = await makeProduct({ stockQty: 10 });
    const code = await db.discountCode.create({ data: { codeNormalized: 'ONCE', type: 'PERCENT', value: 10, maxUses: 1 } });
    const carts = await Promise.all([makeCart([{ productId: pen.id, qty: 1 }], code.id), makeCart([{ productId: pen.id, qty: 1 }], code.id)]);

    const results = await Promise.allSettled(carts.map((cart) => placeOrder({ cartId: cart.id, details, origin })));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.discountCode.findUniqueOrThrow({ where: { id: code.id } })).usedCount).toBe(1);
    // The losing checkout rolled back completely, including its stock reservation.
    expect((await db.product.findUniqueOrThrow({ where: { id: pen.id } })).stockQty).toBe(9);
  });

  it('stores personal data only as ciphertext', async () => {
    const pen = await makeProduct();
    const cart = await makeCart([{ productId: pen.id, qty: 1 }]);
    await placeOrder({ cartId: cart.id, details, origin });

    const rows = await db.$queryRaw<Record<string, unknown>[]>`SELECT * FROM orders`;
    const raw = JSON.stringify(rows);
    for (const value of [details.email, details.name, details.addressLine1, details.city, details.postcode, 'Alice', 'example.com']) {
      expect(raw).not.toContain(value);
    }
    expect(String(rows[0].email_enc)).toMatch(/^v1\./);
  });
});
