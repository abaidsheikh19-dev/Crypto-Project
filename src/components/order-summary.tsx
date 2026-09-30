import { formatCents } from '@/src/lib/pricing';
import type { CartView } from '@/src/lib/cart';

export function CartSummary({ cart, title = 'Order summary' }: { cart: CartView; title?: string }) {
  const { totals } = cart;
  return (
    <aside className="card-pad h-fit" aria-label={title}>
      <h2 className="mb-4 text-xl font-semibold text-white">{title}</h2>
      <ul className="space-y-2 text-sm text-zinc-300">
        {cart.lines.map((line) => (
          <li key={line.productId} className="flex justify-between gap-3">
            <span>{line.name} × {line.quantity}</span>
            <span>{formatCents(line.lineTotalCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 border-t border-emerald-500/20 pt-4 text-sm text-zinc-300">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCents(totals.subtotalCents)}</dd></div>
        {totals.discountCents > 0 ? (
          <div className="flex justify-between text-emerald-300"><dt>Discount ({cart.code})</dt><dd>−{formatCents(totals.discountCents)}</dd></div>
        ) : null}
        <div className="flex justify-between"><dt>Shipping</dt><dd>{totals.shippingCents === 0 ? 'Free' : formatCents(totals.shippingCents)}</dd></div>
        <div className="flex justify-between pt-2 text-base font-semibold text-white"><dt>Total</dt><dd data-testid="summary-total">{formatCents(totals.totalCents)}</dd></div>
      </dl>
    </aside>
  );
}
