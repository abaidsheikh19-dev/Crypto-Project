import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { db } from '@/src/lib/db';
import { paymentsMode } from '@/src/lib/env';
import { demoProvider } from '@/src/lib/payments/demo';
import { formatCents } from '@/src/lib/pricing';
import { STORE_NAME } from '@/src/lib/brand';
import { SubmitButton } from '@/src/components/submit-button';
import { simulatePayment } from './actions';

export const metadata: Metadata = { title: 'Pay invoice', referrer: 'no-referrer' };

// Illustrative only - BTCPay converts at the live exchange rate.
const DEMO_BTC_USD_CENTS = 100_000_00;

function btcAmount(cents: number) {
  return (cents / DEMO_BTC_USD_CENTS).toFixed(8);
}

export default async function DemoInvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  if (paymentsMode() !== 'demo') notFound();
  const { invoiceId } = await params;
  if (!/^demo_[A-Za-z0-9_-]{16}$/.test(invoiceId)) notFound();

  const invoice = await db.mockInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) notFound();
  const live = await demoProvider().getInvoice(invoiceId);
  const status = live?.status ?? 'Expired';
  const order = await db.order.findUnique({ where: { id: invoice.orderId }, select: { orderNumber: true } });

  const address = `bcrt1q${invoice.id.slice(5).toLowerCase().replace(/[^a-z0-9]/g, 'q')}demo0x9h3v`;
  const uri = `bitcoin:${address}?amount=${btcAmount(invoice.amountCents)}`;
  const qr = await QRCode.toString(uri, { type: 'svg', margin: 1, color: { dark: '#0b120f', light: '#ffffff' } });
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(qr).toString('base64')}`;
  const minutesLeft = Math.max(0, Math.ceil((invoice.expiresAt.getTime() - Date.now()) / 60_000));

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="notice-warn mb-6 text-center">
        <strong>Demo payment simulator.</strong> This page stands in for BTCPay Server. No real cryptocurrency moves.
      </p>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white text-zinc-900 shadow-2xl">
        <div className="border-b border-zinc-200 px-6 py-4">
          <p className="text-sm text-zinc-500">{STORE_NAME}</p>
          <p className="font-semibold">Order {order?.orderNumber ?? ''}</p>
        </div>

        <div className="px-6 py-6 text-center">
          <p className="text-3xl font-bold">{btcAmount(invoice.amountCents)} BTC</p>
          <p className="mt-1 text-sm text-zinc-500">{formatCents(invoice.amountCents)} · illustrative demo rate</p>

          {status === 'New' || status === 'Processing' ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="Payment QR code (demo)" className="mx-auto mt-5 h-48 w-48" />
              <p className="mt-3 break-all rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-600">{address}</p>
              <p className="mt-3 text-sm text-zinc-500">
                {status === 'Processing' ? 'Payment detected - waiting for confirmation.' : `Invoice expires in ${minutesLeft} min.`}
              </p>
            </>
          ) : (
            <p className={`mt-6 rounded-xl px-4 py-3 font-medium ${status === 'Settled' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {status === 'Settled' ? 'Invoice paid' : 'Invoice expired'}
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-zinc-200 bg-zinc-50 px-6 py-5">
          {status === 'New' || status === 'Processing' ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Simulate what the customer does</p>
              {status === 'New' ? (
                <form action={simulatePayment}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="outcome" value="Processing" />
                  <SubmitButton className="btn w-full border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100">Payment sent (unconfirmed)</SubmitButton>
                </form>
              ) : null}
              <form action={simulatePayment}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <input type="hidden" name="outcome" value="Settled" />
                <SubmitButton className="btn w-full bg-emerald-600 text-white hover:bg-emerald-500">Payment confirmed</SubmitButton>
              </form>
              {status === 'New' ? (
                <form action={simulatePayment}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="outcome" value="Expired" />
                  <SubmitButton className="btn w-full border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100">Let the invoice expire</SubmitButton>
                </form>
              ) : null}
            </>
          ) : null}
          <a href={invoice.redirectUrl} className="btn w-full text-emerald-700 hover:underline">Return to store</a>
        </div>
      </div>
    </main>
  );
}
