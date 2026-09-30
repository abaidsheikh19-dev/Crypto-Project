import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { StoreShell } from '@/src/components/store-shell';
import { CartSummary } from '@/src/components/order-summary';
import { buildCartView, findCart } from '@/src/lib/cart';
import { COUNTRIES } from '@/src/lib/validators';
import { CheckoutForm } from './checkout-form';
import { readCheckoutDraft } from '@/src/lib/checkout-draft';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const cart = await findCart();
  const view = await buildCartView(cart);
  if (!cart || !view.canCheckout) redirect('/cart');
  const draft = readCheckoutDraft(cart.checkoutDraftEnc);

  return (
    <StoreShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Step 1 of 2</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Checkout</h1>
        </div>
        <Link href="/cart" className="link text-sm">Back to cart</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <CheckoutForm defaults={draft ?? undefined} countries={COUNTRIES} />
        <CartSummary cart={view} />
      </div>
    </StoreShell>
  );
}
