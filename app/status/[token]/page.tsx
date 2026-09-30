import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import { StoreShell } from '@/src/components/store-shell';
import { getOrderByPublicToken, STATUS_LABELS, syncOrderWithProvider } from '@/src/lib/orders';
import { publicTokenSchema } from '@/src/lib/validators';
import { formatCents } from '@/src/lib/pricing';
import { env } from '@/src/lib/env';

// The URL itself is the secret (256 random bits), so keep it out of Referer
// headers and search engines.
export const metadata: Metadata = { title: 'Order status', referrer: 'no-referrer', robots: { index: false } };

const STEPS: OrderStatus[] = ['pending_payment', 'payment_detected', 'paid', 'processing', 'shipped'];

function paymentLink(order: { invoiceId: string | null; paymentProvider: string }) {
  if (!order.invoiceId) return null;
  if (order.paymentProvider === 'demo') return `/pay/demo/${order.invoiceId}`;
  const base = env().BTCPAY_URL?.replace(/\/$/, '');
  return base ? `${base}/i/${encodeURIComponent(order.invoiceId)}` : null;
}

export default async function OrderStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const token = publicTokenSchema.safeParse((await params).token);
  if (!token.success) notFound();
  const order = await getOrderByPublicToken(token.data);
  if (!order) notFound();

  const status = await syncOrderWithProvider(order);
  const awaiting = status === 'pending_payment' || status === 'payment_detected';
  const stepIndex = STEPS.indexOf(status);
  const link = status === 'pending_payment' ? paymentLink(order) : null;

  return (
    <StoreShell>
      {awaiting ? <meta httpEquiv="refresh" content="10" /> : null}
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="card-pad">
          <p className="eyebrow">Order status</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white">Order {order.orderNumber}</h1>
            <span
              data-testid="order-status"
              className={`pill text-sm ${
                status === 'cancelled' || status === 'refunded'
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
              }`}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>

          {stepIndex >= 0 ? (
            <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="Progress">
              {STEPS.map((step, index) => (
                <li key={step} className="text-center">
                  <span className={`block h-1.5 rounded-full ${index <= stepIndex ? 'bg-emerald-400' : 'bg-white/10'}`} />
                  <span className={`mt-2 block text-[11px] leading-4 ${index <= stepIndex ? 'text-emerald-200' : 'text-zinc-500'}`}>
                    {STATUS_LABELS[step]}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          <div className="mt-6 space-y-2 text-sm text-zinc-300">
            {status === 'pending_payment' ? <p>We&apos;re waiting for your payment. This page refreshes by itself.</p> : null}
            {status === 'payment_detected' ? <p>Payment seen on the network - waiting for confirmation. This page refreshes by itself.</p> : null}
            {status === 'paid' || status === 'processing' ? <p>Payment confirmed. We&apos;ve emailed your receipt and will email again when it ships.</p> : null}
            {status === 'shipped' ? (
              <p>Shipped{order.trackingNumber ? <> - tracking number <strong className="text-white">{order.trackingNumber}</strong></> : null}.</p>
            ) : null}
            {status === 'cancelled' ? <p>This order was cancelled because the invoice expired before payment. Nothing was charged.</p> : null}
            {status === 'refunded' ? <p>This order was refunded.</p> : null}
          </div>
          {link ? <a href={link} className="btn-primary mt-5">Continue to payment</a> : null}
        </section>

        <section className="card-pad">
          <h2 className="mb-4 text-lg font-semibold text-white">Items</h2>
          <ul className="space-y-2 text-sm text-zinc-300">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>{item.productNameSnapshot} × {item.qty}</span>
                <span>{formatCents(item.unitPriceCents * item.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-emerald-500/20 pt-4 text-sm text-zinc-300">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCents(order.subtotalCents)}</dd></div>
            {order.discountCents > 0 ? <div className="flex justify-between text-emerald-300"><dt>Discount</dt><dd>−{formatCents(order.discountCents)}</dd></div> : null}
            <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shippingCents === 0 ? 'Free' : formatCents(order.shippingCents)}</dd></div>
            <div className="flex justify-between pt-2 text-base font-semibold text-white"><dt>Total</dt><dd>{formatCents(order.totalCents)}</dd></div>
          </dl>
        </section>

        <p className="text-center text-sm text-zinc-500">
          Bookmark this page to check your order later. For privacy, it never shows your address.{' '}
          <Link href="/" className="link">Back to shop</Link>
        </p>
      </div>
    </StoreShell>
  );
}
