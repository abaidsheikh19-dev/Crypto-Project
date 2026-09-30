import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { AdminShell, Flash, StatusPill } from '@/src/components/admin-shell';
import { SubmitButton } from '@/src/components/submit-button';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { decryptOptional } from '@/src/lib/crypto';
import { audit } from '@/src/lib/audit';
import { clientIpHash } from '@/src/lib/request';
import { formatCents } from '@/src/lib/pricing';
import { countryName } from '@/src/lib/validators';
import { updateOrderStatus } from '../actions';

export const metadata: Metadata = { title: 'Order' };

const MESSAGES: Record<string, { text: string; tone: 'info' | 'warn' }> = {
  updated: { text: 'Order updated.', tone: 'info' },
  not_allowed: { text: 'That change is not allowed from the order’s current status.', tone: 'warn' },
};

function when(date: Date | null) {
  return date ? date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—';
}

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reveal?: string; msg?: string }> }) {
  const context = await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse((await params).id);
  if (!id.success) notFound();
  const order = await db.order.findUnique({ where: { id: id.data }, include: { items: true, discountCode: true } });
  if (!order) notFound();
  const query = await searchParams;
  const reveal = query.reveal === '1' && !order.piiPurgedAt;

  let address: { name: string | null; email: string | null; lines: string[] } | null = null;
  if (reveal) {
    // Every decryption of a customer's address is recorded (order ID only).
    await audit({ type: 'admin', id: context.admin.id }, 'order.address_viewed', { type: 'order', id: order.id }, undefined, { ipHash: await clientIpHash() });
    const country = decryptOptional(order.countryEnc);
    address = {
      name: decryptOptional(order.nameEnc),
      email: decryptOptional(order.emailEnc),
      lines: [
        decryptOptional(order.addressLine1Enc),
        decryptOptional(order.addressLine2Enc),
        [decryptOptional(order.cityEnc), decryptOptional(order.regionEnc), decryptOptional(order.postcodeEnc)].filter(Boolean).join(', '),
        country ? countryName(country) : null,
      ].filter((line): line is string => Boolean(line)),
    };
  }
  const message = MESSAGES[query.msg ?? ''];

  return (
    <AdminShell context={context} title={`Order ${order.orderNumber}`} actions={<Link href="/admin/orders" className="btn-ghost">All orders</Link>}>
      <Flash message={message?.text} tone={message?.tone} />
      {order.needsReview ? (
        <div className="notice-error mb-6">
          This invoice was paid after it had expired, so the reserved stock was already released. Check stock, then either
          ship (after setting it back to paid in BTCPay) or refund in BTCPay.
          <form action={updateOrderStatus} className="mt-2">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="action" value="clear_review" />
            <SubmitButton className="btn-ghost">Mark reviewed</SubmitButton>
          </form>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="card-pad">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={order.status} />
              <span className="text-sm text-zinc-400">Placed {when(order.createdAt)}</span>
            </div>
            <table className="table mt-4">
              <thead><tr><th>Item</th><th>Qty</th><th className="text-right">Unit</th><th className="text-right">Line</th></tr></thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productNameSnapshot}</td>
                    <td>{item.qty}</td>
                    <td className="text-right">{formatCents(item.unitPriceCents)}</td>
                    <td className="text-right">{formatCents(item.unitPriceCents * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm text-zinc-300">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCents(order.subtotalCents)}</dd></div>
              <div className="flex justify-between"><dt>Discount{order.discountCode ? ` (${order.discountCode.codeNormalized})` : ''}</dt><dd>−{formatCents(order.discountCents)}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd>{formatCents(order.shippingCents)}</dd></div>
              <div className="flex justify-between font-semibold text-white"><dt>Total</dt><dd>{formatCents(order.totalCents)}</dd></div>
            </dl>
          </section>

          <section className="card-pad">
            <h2 className="mb-3 font-semibold text-white">Shipping details</h2>
            {order.piiPurgedAt ? (
              <p className="text-sm text-zinc-400">Personal data was deleted by the retention purge on {when(order.piiPurgedAt)}.</p>
            ) : address ? (
              <div className="text-sm leading-6 text-zinc-200">
                <p className="font-medium">{address.name}</p>
                {address.lines.map((line) => <p key={line}>{line}</p>)}
                <p className="mt-2 text-zinc-400">{address.email}</p>
                <p className="mt-3 text-xs text-zinc-500">This view was recorded in the audit log.</p>
              </div>
            ) : (
              <form method="get">
                <input type="hidden" name="reveal" value="1" />
                <p className="mb-3 text-sm text-zinc-400">The address is encrypted. Showing it is recorded in the audit log.</p>
                <button type="submit" className="btn-secondary">Show shipping address</button>
              </form>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card-pad space-y-3 text-sm">
            <h2 className="font-semibold text-white">Actions</h2>
            {order.status === 'paid' ? (
              <form action={updateOrderStatus}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="action" value="processing" />
                <SubmitButton className="btn-secondary w-full">Mark as processing</SubmitButton>
              </form>
            ) : null}
            {order.status === 'paid' || order.status === 'processing' ? (
              <form action={updateOrderStatus} className="space-y-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="action" value="shipped" />
                <label htmlFor="trackingNumber" className="label">Tracking number (optional)</label>
                <input id="trackingNumber" name="trackingNumber" maxLength={80} className="input" />
                <SubmitButton className="btn-primary w-full">Mark shipped &amp; email customer</SubmitButton>
              </form>
            ) : null}
            {order.status === 'paid' || order.status === 'processing' || order.status === 'shipped' ? (
              <form action={updateOrderStatus}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="action" value="refunded" />
                <p className="mb-2 text-xs text-zinc-500">Send the refund in BTCPay first, then record it here.</p>
                <SubmitButton className="btn-danger w-full">Mark refunded</SubmitButton>
              </form>
            ) : null}
            {order.status === 'pending_payment' || order.status === 'payment_detected' ? (
              <form action={updateOrderStatus}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="action" value="cancel" />
                <SubmitButton className="btn-danger w-full">Cancel and release stock</SubmitButton>
              </form>
            ) : null}
            {order.status === 'cancelled' || order.status === 'refunded' ? <p className="text-zinc-400">No actions available.</p> : null}
          </section>
          <section className="card-pad text-sm text-zinc-300">
            <h2 className="mb-2 font-semibold text-white">Timeline</h2>
            <dl className="space-y-1">
              <div className="flex justify-between gap-2"><dt className="text-zinc-400">Paid</dt><dd>{when(order.paidAt)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-zinc-400">Shipped</dt><dd>{when(order.shippedAt)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-zinc-400">Tracking</dt><dd>{order.trackingNumber ?? '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-zinc-400">Invoice</dt><dd className="truncate font-mono text-xs">{order.invoiceId ?? '—'}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
