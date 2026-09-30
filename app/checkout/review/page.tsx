import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { StoreShell } from '@/src/components/store-shell';
import { CartSummary } from '@/src/components/order-summary';
import { SubmitButton } from '@/src/components/submit-button';
import { buildCartView, findCart } from '@/src/lib/cart';
import { countryName } from '@/src/lib/validators';
import { paymentsMode } from '@/src/lib/env';
import { payNow } from '../actions';
import { readCheckoutDraft } from '@/src/lib/checkout-draft';

export const metadata: Metadata = { title: 'Review order' };

const ERRORS: Record<string, string> = {
  payment_unavailable: 'The payment server could not create an invoice. Your items were not charged - please try again shortly.',
  slow_down: 'Too many attempts. Please wait a few minutes and try again.',
};

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cart = await findCart();
  const view = await buildCartView(cart);
  if (!cart || !view.canCheckout) redirect('/cart');
  const details = readCheckoutDraft(cart.checkoutDraftEnc);
  if (!details) redirect('/checkout');
  const error = ERRORS[(await searchParams).error ?? ''];

  return (
    <StoreShell>
      <div className="mb-6">
        <p className="eyebrow">Step 2 of 2</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Review and pay</h1>
      </div>
      {error ? <p role="alert" className="notice-error mb-6">{error}</p> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="card-pad space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Ship to</h2>
              <address className="mt-2 not-italic leading-6 text-zinc-300">
                {details.name}<br />
                {details.addressLine1}<br />
                {details.addressLine2 ? <>{details.addressLine2}<br /></> : null}
                {details.city}{details.region ? `, ${details.region}` : ''} {details.postcode}<br />
                {countryName(details.country)}
              </address>
              <p className="mt-3 text-sm text-zinc-400">Confirmation to <span className="text-zinc-200">{details.email}</span></p>
            </div>
            <Link href="/checkout" className="link text-sm">Edit</Link>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-black/20 p-4 text-sm text-zinc-300">
            <p className="font-medium text-white">How payment works</p>
            <p className="mt-1">
              Your items are held for you while you pay. You&apos;ll be taken to our BTCPay Server checkout to pay with
              Bitcoin, Lightning or another supported coin, then brought back to your order status page.
            </p>
            {paymentsMode() === 'demo' ? (
              <p className="mt-2 text-amber-200">Demo mode: payment is simulated and no real cryptocurrency moves.</p>
            ) : null}
          </div>

          <form action={payNow}>
            <SubmitButton className="btn-primary w-full py-3 text-base" pendingText="Creating invoice…">
              Pay {view.totals.totalCents > 0 ? 'with crypto' : ''}
            </SubmitButton>
          </form>
        </section>
        <CartSummary cart={view} />
      </div>
    </StoreShell>
  );
}
