import { db } from '../../src/lib/db';
import { hashToken, randomToken } from '../../src/lib/crypto';
import type { CheckoutDetails } from '../../src/lib/validators';

export const details: CheckoutDetails = {
  email: 'alice@example.com',
  name: 'Alice Example',
  addressLine1: '1 Test Street',
  addressLine2: 'Flat 2',
  city: 'Springfield',
  region: 'IL',
  postcode: '62701',
  country: 'US',
};

export async function resetDb() {
  await db.$executeRaw`TRUNCATE TABLE products, product_images, stock_adjustments, promotions, discount_codes, carts, cart_items, orders,
    order_items, stock_reservations, webhook_events, mock_invoices, settings, admin_users, sessions, audit_logs, email_outbox, rate_limits
    RESTART IDENTITY CASCADE`;
}

let seq = 0;
export async function makeProduct(overrides: Partial<{ priceCents: number; stockQty: number; name: string }> = {}) {
  seq++;
  return db.product.create({
    data: { slug: `product-${seq}`, sku: `SKU-${seq}`, name: overrides.name ?? `Product ${seq}`, description: 'Test', priceCents: overrides.priceCents ?? 1000, stockQty: overrides.stockQty ?? 10 },
  });
}

export async function makeCart(items: { productId: number; qty: number }[], discountCodeId?: number) {
  return db.cart.create({
    data: {
      tokenHash: hashToken(randomToken()),
      expiresAt: new Date(Date.now() + 86_400_000),
      discountCodeId,
      items: { create: items },
    },
  });
}
