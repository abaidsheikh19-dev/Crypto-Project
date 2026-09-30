import Link from 'next/link';
import type { Metadata } from 'next';
import { AdminShell, StatusPill } from '@/src/components/admin-shell';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { formatCents } from '@/src/lib/pricing';
import { getSettings } from '@/src/lib/settings';
import { FINAL_STATUSES } from '@/src/lib/orders';

export const metadata: Metadata = { title: 'Admin dashboard' };

export default async function AdminDashboardPage() {
  const context = await requireAdmin();
  const settings = await getSettings();
  const cutoff = new Date(Date.now() - settings.retention_days * 24 * 60 * 60 * 1000);

  const [awaitingShipment, awaitingPayment, paidTotal, products, recent, staleOpen, needsReview] = await Promise.all([
    db.order.count({ where: { status: { in: ['paid', 'processing'] } } }),
    db.order.count({ where: { status: { in: ['pending_payment', 'payment_detected'] } } }),
    db.order.aggregate({ _sum: { totalCents: true }, where: { status: { in: ['paid', 'processing', 'shipped'] } } }),
    db.product.findMany({ where: { isActive: true }, orderBy: { stockQty: 'asc' }, select: { id: true, name: true, stockQty: true, lowStockThreshold: true } }),
    db.order.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, orderNumber: true, status: true, totalCents: true, createdAt: true } }),
    db.order.count({ where: { status: { notIn: FINAL_STATUSES }, createdAt: { lte: cutoff } } }),
    db.order.count({ where: { needsReview: true } }),
  ]);
  const lowStock = products.filter((p) => p.stockQty <= p.lowStockThreshold);

  const stats = [
    { label: 'Awaiting shipment', value: awaitingShipment, href: '/admin/orders?status=paid' },
    { label: 'Awaiting payment', value: awaitingPayment, href: '/admin/orders?status=pending_payment' },
    { label: 'Low-stock products', value: lowStock.length, href: '/admin/products' },
    { label: 'Paid sales (all time)', value: formatCents(paidTotal._sum.totalCents ?? 0), href: '/admin/orders' },
  ];

  return (
    <AdminShell context={context} title="Dashboard">
      {staleOpen > 0 ? (
        <p className="notice-warn mb-6">
          {staleOpen} unfinished order{staleOpen === 1 ? ' is' : 's are'} older than the {settings.retention_days}-day retention window.
          Their personal data is kept until you ship, cancel or refund them.
        </p>
      ) : null}
      {needsReview > 0 ? (
        <p className="notice-error mb-6">
          {needsReview} order{needsReview === 1 ? ' was' : 's were'} paid after the invoice expired and need{needsReview === 1 ? 's' : ''} manual review.{' '}
          <Link href="/admin/orders?review=1" className="link">Review</Link>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="card-pad block hover:border-emerald-400/40">
            <p className="text-sm text-zinc-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card-pad">
          <h2 className="mb-3 font-semibold text-white">Recent orders</h2>
          {recent.length === 0 ? <p className="text-sm text-zinc-400">No orders yet.</p> : (
            <table className="table">
              <thead><tr><th>Order</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {recent.map((order) => (
                  <tr key={order.id}>
                    <td><Link href={`/admin/orders/${order.id}`} className="link font-mono">{order.orderNumber}</Link></td>
                    <td>{order.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                    <td><StatusPill status={order.status} /></td>
                    <td className="text-right">{formatCents(order.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card-pad">
          <h2 className="mb-3 font-semibold text-white">Low stock</h2>
          {lowStock.length === 0 ? <p className="text-sm text-zinc-400">Everything is above its low-stock threshold.</p> : (
            <ul className="space-y-2 text-sm">
              {lowStock.map((product) => (
                <li key={product.id} className="flex justify-between">
                  <Link href={`/admin/products/${product.id}`} className="link">{product.name}</Link>
                  <span className={product.stockQty === 0 ? 'text-red-300' : 'text-amber-200'}>{product.stockQty} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
