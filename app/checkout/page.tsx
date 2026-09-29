import Link from 'next/link';
import { getCartCookieValue } from '@/src/lib/cart';
import { formatPriceCents, getProducts } from '@/src/lib/products';
import { calculateTotals } from '@/src/lib/pricing';

export default function CheckoutPage() {
  const items = getCartCookieValue();
  const products = getProducts();
  const cartItems = items
    .flatMap((entry) => {
      const product = products.find((candidate) => candidate.id === entry.productId);
      if (!product) return [];
      return [{
        ...product,
        quantity: entry.quantity,
      }];
    });

  const totals = calculateTotals({
    items: cartItems.map((item) => ({
      productId: item.id,
      name: item.name,
      unitPriceCents: item.priceCents,
      quantity: item.quantity,
    })),
    shippingCents: cartItems.length ? 500 : 0,
  });

  return (
    <main className="min-h-screen px-6 py-8 text-zinc-100 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-white">Checkout</h1>
          <Link href="/cart" className="text-sm font-medium text-emerald-300">Back to cart</Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <form action="/api/checkout" method="post" className="space-y-5 rounded-[28px] border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(15,24,20,0.95),rgba(9,17,14,0.95))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.26)]">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Full name</label>
              <input name="name" required className="w-full rounded-xl border border-emerald-500/30 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-emerald-400" />
            </div>
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Email</label>
              <input type="email" name="email" required className="w-full rounded-xl border border-emerald-500/30 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-emerald-400" />
            </div>
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Address</label>
              <textarea name="address" required className="h-24 w-full rounded-xl border border-emerald-500/30 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-emerald-400" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">City</label>
                <input name="city" required className="w-full rounded-xl border border-emerald-500/30 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-emerald-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Postcode</label>
                <input name="postcode" required className="w-full rounded-xl border border-emerald-500/30 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-emerald-400" />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Country</label>
              <input name="country" required className="w-full rounded-xl border border-emerald-500/30 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-emerald-400" />
            </div>
            <button type="submit" className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-base font-semibold text-ink-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400">
              Pay with Bitcoin
            </button>
          </form>

          <aside className="rounded-[24px] border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(15,24,20,0.95),rgba(9,17,14,0.95))] p-5 shadow-[0_18px_38px_rgba(0,0,0,0.24)]">
            <h2 className="mb-4 text-xl font-semibold text-white">Summary</h2>
            <div className="space-y-3 text-sm text-zinc-300">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between gap-3">
                  <span>{item.name} × {item.quantity}</span>
                  <span>{formatPriceCents(item.priceCents * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-emerald-500/20 pt-3">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatPriceCents(totals.subtotalCents)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span>{formatPriceCents(totals.shippingCents)}</span></div>
                <div className="mt-3 flex justify-between text-base font-semibold text-white"><span>Total</span><span>{formatPriceCents(totals.totalCents)}</span></div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
