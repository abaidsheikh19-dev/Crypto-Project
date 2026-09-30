import Link from 'next/link';
import type { Metadata } from 'next';
import { StoreShell } from '@/src/components/store-shell';
import { getCartView } from '@/src/lib/cart';
import { formatCents } from '@/src/lib/pricing';
import { applyDiscountCode, removeDiscountCode, removeItem, updateQuantity } from './actions';

export const metadata: Metadata = { title: 'Cart' };

const NOTICES: Record<string, { tone: 'info' | 'warn' | 'error'; text: string }> = {
  added: { tone: 'info', text: 'Added to your cart.' },
  capped: { tone: 'warn', text: 'We only have so many in stock, so the quantity was capped.' },
  unavailable: { tone: 'warn', text: 'That item is no longer available and was removed.' },
  invalid: { tone: 'error', text: 'That request was not valid.' },
  slow_down: { tone: 'error', text: 'Too many requests. Please wait a moment and try again.' },
  out_of_stock: { tone: 'warn', text: 'Some items sold out while you were checking out. Please review your cart.' },
  code_invalid: { tone: 'warn', text: 'Your discount code can no longer be used and was not applied.' },
};

const CODE_NOTICES: Record<string, { tone: 'info' | 'warn' | 'error'; text: string }> = {
  applied: { tone: 'info', text: 'Discount code applied.' },
  invalid: { tone: 'error', text: 'That code is not valid.' },
  below_minimum: { tone: 'warn', text: 'Your order does not meet the minimum for that code yet.' },
  slow_down: { tone: 'error', text: 'Too many attempts. Please wait a few minutes.' },
};

export default async function CartPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const cart = await getCartView();
  const notice = NOTICES[params.notice ?? ''];
  const codeNotice = CODE_NOTICES[params.code ?? ''];
  const { totals } = cart;

  return (
    <StoreShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-white">Your cart</h1>
        <Link href="/" className="link text-sm">Continue shopping</Link>
      </div>

      {notice ? <p role="status" className={`notice-${notice.tone} mb-6`}>{notice.text}</p> : null}

      {cart.lines.length === 0 ? (
        <div className="card-pad text-center">
          <p className="text-zinc-300">Your cart is empty.</p>
          <Link href="/" className="btn-primary mt-4">Browse products</Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <ul className="space-y-3" aria-label="Cart items">
            {cart.lines.map((line) => (
              <li key={line.productId} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                {line.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={line.image} alt="" className="h-20 w-20 flex-none rounded-2xl border border-emerald-500/20 object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${line.slug}`} className="font-semibold text-white hover:text-emerald-200">{line.name}</Link>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    {line.onSale ? (
                      <><span className="text-emerald-300">{formatCents(line.saleUnitPriceCents)}</span> <s>{formatCents(line.unitPriceCents)}</s></>
                    ) : formatCents(line.unitPriceCents)}{' '}each
                  </p>
                  {line.overStock ? <p className="mt-1 text-sm text-amber-200">Only {line.stockQty} left - please lower the quantity.</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <form action={updateQuantity} className="flex items-center gap-2">
                    <input type="hidden" name="productId" value={line.productId} />
                    <label htmlFor={`qty-${line.productId}`} className="sr-only">Quantity for {line.name}</label>
                    <input
                      id={`qty-${line.productId}`}
                      type="number"
                      name="quantity"
                      min={1}
                      max={Math.max(1, line.stockQty)}
                      defaultValue={line.quantity}
                      className="input w-20 text-center"
                    />
                    <button type="submit" className="btn-ghost px-3">Update</button>
                  </form>
                  <form action={removeItem}>
                    <input type="hidden" name="productId" value={line.productId} />
                    <button type="submit" className="btn-ghost px-3" aria-label={`Remove ${line.name}`}>Remove</button>
                  </form>
                </div>
                <p className="text-right font-semibold text-white sm:w-24">{formatCents(line.lineTotalCents)}</p>
              </li>
            ))}
          </ul>

          <aside className="card-pad h-fit space-y-5" aria-label="Order summary">
            <h2 className="text-xl font-semibold text-white">Summary</h2>

            <div>
              {cart.code ? (
                <form action={removeDiscountCode} className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                  <span>Code <strong className="text-emerald-200">{cart.code}</strong></span>
                  <button type="submit" className="link">Remove</button>
                </form>
              ) : (
                <form action={applyDiscountCode} className="flex gap-2">
                  <label htmlFor="code" className="sr-only">Discount code</label>
                  <input id="code" name="code" placeholder="Discount code" autoComplete="off" maxLength={40} className="input" />
                  <button type="submit" className="btn-secondary">Apply</button>
                </form>
              )}
              {codeNotice ? <p role="status" className={`notice-${codeNotice.tone} mt-3`}>{codeNotice.text}</p> : null}
              {cart.code && totals.codeStatus !== 'applied' ? (
                <p className="notice-warn mt-3">This code no longer applies to your cart.</p>
              ) : null}
            </div>

            <dl className="space-y-2 text-sm text-zinc-300">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCents(totals.listSubtotalCents)}</dd></div>
              {totals.itemSavingsCents > 0 ? (
                <div className="flex justify-between text-emerald-300"><dt>Sale savings</dt><dd>−{formatCents(totals.itemSavingsCents)}</dd></div>
              ) : null}
              {totals.discountCents > 0 ? (
                <div className="flex justify-between text-emerald-300"><dt>Discount</dt><dd>−{formatCents(totals.discountCents)}</dd></div>
              ) : null}
              <div className="flex justify-between"><dt>Shipping</dt><dd>{totals.shippingCents === 0 ? 'Free' : formatCents(totals.shippingCents)}</dd></div>
              <div className="flex justify-between border-t border-emerald-500/20 pt-3 text-base font-semibold text-white">
                <dt>Total</dt><dd data-testid="cart-total">{formatCents(totals.totalCents)}</dd>
              </div>
            </dl>

            {cart.canCheckout ? (
              <Link href="/checkout" className="btn-primary w-full py-3 text-base">Checkout</Link>
            ) : (
              <p className="notice-warn">Adjust the highlighted items to continue.</p>
            )}
            <p className="text-center text-xs text-zinc-500">Prices are confirmed on our server at checkout.</p>
          </aside>
        </div>
      )}
    </StoreShell>
  );
}
