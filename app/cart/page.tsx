import Link from 'next/link';
import { getCartCookieValue } from '@/src/lib/cart';
import { formatPriceCents, getProducts } from '@/src/lib/products';
import { calculateTotals } from '@/src/lib/pricing';

export default function CartPage() {
  const items = getCartCookieValue();
  const products = getProducts();
  const cartItems = items
    .flatMap((entry) => {
      const product = products.find((candidate) => candidate.id === entry.productId);
      if (!product) return [];
      return [{
        ...product,
        quantity: entry.quantity,
        lineTotalCents: product.priceCents * entry.quantity,
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
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-white">Cart</h1>
          <Link href="/catalog" className="text-sm font-medium text-emerald-300">Continue shopping</Link>
        </div>

        {cartItems.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-ink-900/80 p-8 text-center text-zinc-300 shadow-xl shadow-black/20">
            Your cart is empty.
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-ink-900/80 p-4 shadow-lg shadow-black/10">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{item.name}</h2>
                    <p className="text-sm text-zinc-400">{formatPriceCents(item.priceCents)} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <form action="/api/cart" method="post">
                      <input type="hidden" name="productId" value={item.id} />
                      <input type="hidden" name="quantity" value={Math.max(1, item.quantity - 1)} />
                      <button type="submit" className="rounded-lg border border-emerald-500/30 px-2.5 py-1.5 text-sm text-zinc-200 transition hover:border-emerald-400 hover:text-white">
                        −
                      </button>
                    </form>
                    <span className="min-w-8 text-center text-sm font-medium text-white">{item.quantity}</span>
                    <form action="/api/cart" method="post">
                      <input type="hidden" name="productId" value={item.id} />
                      <input type="hidden" name="quantity" value={item.quantity + 1} />
                      <button type="submit" className="rounded-lg border border-emerald-500/30 px-2.5 py-1.5 text-sm text-zinc-200 transition hover:border-emerald-400 hover:text-white">
                        +
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <aside className="rounded-[24px] border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(15,24,20,0.95),rgba(9,17,14,0.95))] p-5 shadow-[0_18px_38px_rgba(0,0,0,0.26)]">
              <h2 className="mb-4 text-xl font-semibold text-white">Order summary</h2>
              <div className="space-y-2 text-sm text-zinc-300">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatPriceCents(totals.subtotalCents)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>{formatPriceCents(totals.discountCents)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span>{formatPriceCents(totals.shippingCents)}</span></div>
                <div className="mt-3 flex justify-between border-t border-emerald-500/20 pt-3 text-base font-semibold text-white">
                  <span>Total</span>
                  <span>{formatPriceCents(totals.totalCents)}</span>
                </div>
              </div>
              <Link
                href="/checkout"
                className="mt-6 block rounded-xl bg-emerald-500 px-4 py-3 text-center font-semibold text-ink-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Proceed to checkout
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
