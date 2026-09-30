import { beforeEach, describe, expect, it } from 'vitest';
import type { OrderStatus } from '@prisma/client';
import { db } from '../../src/lib/db';
import { encrypt, hashToken, randomToken } from '../../src/lib/crypto';
import { runPurge } from '../../src/server/purge';
import { makeProduct, resetDb } from '../support/factories';

const DAY = 86_400_000;

async function order(status: OrderStatus, ageDays: number, productId: number) {
  return db.order.create({
    data: {
      orderNumber: randomToken(6),
      publicTokenHash: hashToken(randomToken()),
      publicTokenEnc: encrypt('token'),
      status,
      subtotalCents: 2000,
      discountCents: 0,
      shippingCents: 500,
      totalCents: 2500,
      emailEnc: encrypt('bob@example.com'),
      nameEnc: encrypt('Bob'),
      addressLine1Enc: encrypt('2 Road'),
      cityEnc: encrypt('Town'),
      postcodeEnc: encrypt('12345'),
      countryEnc: encrypt('US'),
      paymentProvider: 'demo',
      createdAt: new Date(Date.now() - ageDays * DAY),
      items: { create: [{ productId, productNameSnapshot: 'Pen', unitPriceCents: 1000, qty: 2 }] },
    },
  });
}

describe('retention purge', () => {
  beforeEach(resetDb);

  it('removes personal data only from finished orders past the window, keeping totals and line items', async () => {
    const product = await makeProduct();
    const oldShipped = await order('shipped', 40, product.id);
    const oldCancelled = await order('cancelled', 40, product.id);
    const oldRefunded = await order('refunded', 40, product.id);
    const oldPaid = await order('paid', 40, product.id); // not final: must be kept and flagged
    const recentShipped = await order('shipped', 5, product.id); // inside the 30-day window
    await db.emailOutbox.create({ data: { template: 't', toEnc: encrypt('bob@example.com'), subjectEnc: encrypt('s'), bodyTextEnc: encrypt('b'), bodyHtmlEnc: encrypt('b'), orderId: oldShipped.id } });

    const summary = await runPurge();

    expect(summary).toMatchObject({ retentionDays: 30, ordersPurged: 3, staleOpenOrders: 1, emailsDeleted: 1 });
    for (const purged of [oldShipped, oldCancelled, oldRefunded]) {
      const row = await db.order.findUniqueOrThrow({ where: { id: purged.id }, include: { items: true } });
      expect(row).toMatchObject({ emailEnc: null, nameEnc: null, addressLine1Enc: null, cityEnc: null, postcodeEnc: null, countryEnc: null, publicTokenEnc: null });
      expect(row.piiPurgedAt).not.toBeNull();
      expect(row).toMatchObject({ totalCents: 2500, status: purged.status });
      expect(row.items).toMatchObject([{ productNameSnapshot: 'Pen', qty: 2, unitPriceCents: 1000 }]);
    }
    for (const kept of [oldPaid, recentShipped]) {
      const row = await db.order.findUniqueOrThrow({ where: { id: kept.id } });
      expect(row.emailEnc).not.toBeNull();
      expect(row.piiPurgedAt).toBeNull();
    }
    expect(await db.auditLog.count({ where: { action: 'retention.purge_run' } })).toBe(1);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'retention.purge_run' } });
    expect(JSON.stringify(audit.metadata)).not.toContain('bob');
  });

  it('honours a changed retention window', async () => {
    const product = await makeProduct();
    const shipped = await order('shipped', 10, product.id);
    await db.setting.create({ data: { key: 'retention_days', value: '7' } });
    await runPurge();
    expect((await db.order.findUniqueOrThrow({ where: { id: shipped.id } })).piiPurgedAt).not.toBeNull();
  });

  it('clears expired carts, sessions and old webhook event IDs', async () => {
    await db.cart.create({ data: { tokenHash: 'old', expiresAt: new Date(Date.now() - DAY) } });
    await db.cart.create({ data: { tokenHash: 'live', expiresAt: new Date(Date.now() + DAY) } });
    await db.session.create({ data: { idHash: 'x', subjectType: 'ADMIN', subjectId: 1, expiresAt: new Date(Date.now() - 1000) } });
    await db.webhookEvent.create({ data: { provider: 'demo', eventId: 'old', receivedAt: new Date(Date.now() - 31 * DAY) } });
    await db.webhookEvent.create({ data: { provider: 'demo', eventId: 'new' } });

    const summary = await runPurge();

    expect(summary).toMatchObject({ cartsDeleted: 1, sessionsDeleted: 1, webhookEventsDeleted: 1 });
    expect(await db.cart.count()).toBe(1);
    expect(await db.webhookEvent.count()).toBe(1);
  });
});
