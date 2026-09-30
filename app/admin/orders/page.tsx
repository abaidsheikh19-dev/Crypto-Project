import Link from 'next/link';
import type { Metadata } from 'next';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { AdminShell, StatusPill } from '@/src/components/admin-shell';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { formatCents } from '@/src/lib/pricing';
import { STATUS_LABELS } from '@/src/lib/orders';

export const metadata: Metadata = { title: 'Orders' };

const STATUSES = Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
const filterSchema = z.object({
  status: z.enum(STATUSES as [string, ...string[]]).optional().catch(undefined),
  from: dateSchema,
  to: dateSchema,
  review: z.literal('1').optional().catch(undefined),
});

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const context = await requireAdmin();
  const filters = filterSchema.parse(await searchParams);

  const where: Prisma.OrderWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.OrderWhereInput['status'];
  if (filters.review) where.needsReview = true;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00Z`) } : {}),
      ...(filters.to ? { lt: new Date(new Date(`${filters.to}T00:00:00Z`).getTime() + 86_400_000) } : {}),
    };
  }
  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { _count: { select: { items: true } } },
  });

  return (
    <AdminShell context={context} title="Orders">
      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4" method="get">
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={filters.status ?? ''} className="input">
            <option value="">All</option>
            {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="label">From (UTC)</label>
          <input id="from" name="from" type="date" defaultValue={filters.from} className="input" />
        </div>
        <div>
          <label htmlFor="to" className="label">To (UTC)</label>
          <input id="to" name="to" type="date" defaultValue={filters.to} className="input" />
        </div>
        <button type="submit" className="btn-secondary">Filter</button>
        <Link href="/admin/orders" className="btn-ghost">Reset</Link>
      </form>

      <div className="card overflow-x-auto p-2">
        {orders.length === 0 ? <p className="p-4 text-sm text-zinc-400">No orders match.</p> : (
          <table className="table">
            <thead><tr><th>Order</th><th>Placed (UTC)</th><th>Status</th><th>Items</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/orders/${order.id}`} className="link font-mono">{order.orderNumber}</Link>
                    {order.needsReview ? <span className="pill ml-2 border-red-500/40 text-red-200">review</span> : null}
                    {order.piiPurgedAt ? <span className="pill ml-2 border-white/10 text-zinc-400">purged</span> : null}
                  </td>
                  <td>{order.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                  <td><StatusPill status={order.status} /></td>
                  <td>{order._count.items}</td>
                  <td className="text-zinc-400">{order.paymentProvider}</td>
                  <td className="text-right">{formatCents(order.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
