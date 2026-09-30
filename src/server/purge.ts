import 'server-only';
import { db } from '@/src/lib/db';
import { audit, type AuditActor } from '@/src/lib/audit';
import { getSettings, setMeta } from '@/src/lib/settings';
import { FINAL_STATUSES } from '@/src/lib/orders';

export type PurgeSummary = {
  ranAt: string;
  retentionDays: number;
  ordersPurged: number;
  staleOpenOrders: number;
  emailsDeleted: number;
  cartsDeleted: number;
  sessionsDeleted: number;
  webhookEventsDeleted: number;
  mockInvoicesDeleted: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Retention purge. Hard-deletes personal data from finished orders older than
 * the retention window and clears short-lived records. Anonymous order rows
 * (number, date, items, totals, status) stay for stock and sales figures.
 * Orders past the window that are not finished are only counted, and shown on
 * the admin dashboard for a human to resolve.
 */
export async function runPurge(actor: AuditActor = { type: 'system' }, now = new Date()): Promise<PurgeSummary> {
  const settings = await getSettings();
  const cutoff = new Date(now.getTime() - settings.retention_days * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  const summary = await db.$transaction(async (tx) => {
    const eligible = await tx.order.findMany({
      where: { status: { in: FINAL_STATUSES }, piiPurgedAt: null, createdAt: { lte: cutoff } },
      select: { id: true },
    });
    const ids = eligible.map((order) => order.id);

    const orders = await tx.order.updateMany({
      where: { id: { in: ids } },
      data: {
        emailEnc: null,
        nameEnc: null,
        addressLine1Enc: null,
        addressLine2Enc: null,
        cityEnc: null,
        regionEnc: null,
        postcodeEnc: null,
        countryEnc: null,
        publicTokenEnc: null,
        piiPurgedAt: now,
      },
    });

    const emails = await tx.emailOutbox.deleteMany({
      where: { OR: [{ createdAt: { lte: cutoff } }, { orderId: { in: ids } }] },
    });
    const carts = await tx.cart.deleteMany({ where: { expiresAt: { lte: now } } });
    const sessions = await tx.session.deleteMany({ where: { expiresAt: { lte: now } } });
    const webhooks = await tx.webhookEvent.deleteMany({ where: { receivedAt: { lte: thirtyDaysAgo } } });
    const mockInvoices = await tx.mockInvoice.deleteMany({ where: { createdAt: { lte: cutoff } } });
    await tx.rateLimit.deleteMany({ where: { resetAt: { lte: now } } });

    const staleOpenOrders = await tx.order.count({
      where: { status: { notIn: FINAL_STATUSES }, createdAt: { lte: cutoff } },
    });

    return {
      ranAt: now.toISOString(),
      retentionDays: settings.retention_days,
      ordersPurged: orders.count,
      staleOpenOrders,
      emailsDeleted: emails.count,
      cartsDeleted: carts.count,
      sessionsDeleted: sessions.count,
      webhookEventsDeleted: webhooks.count,
      mockInvoicesDeleted: mockInvoices.count,
    };
  });

  await audit(actor, 'retention.purge_run', null, summary);
  await setMeta('purge_last_run', JSON.stringify(summary));
  return summary;
}
