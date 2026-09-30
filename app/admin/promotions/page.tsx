import type { Metadata } from 'next';
import { AdminShell, Flash } from '@/src/components/admin-shell';
import { SubmitButton } from '@/src/components/submit-button';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { formatCents, isWithinWindow } from '@/src/lib/pricing';
import { createDiscountCode, createPromotion, toggleDiscountCode, togglePromotion } from './actions';

export const metadata: Metadata = { title: 'Promotions' };

const MESSAGES: Record<string, { text: string; tone: 'info' | 'error' }> = {
  code_created: { text: 'Discount code created.', tone: 'info' },
  code_invalid: { text: 'Check the code details: percent is 1–100, amounts look like 5.00.', tone: 'error' },
  code_exists: { text: 'That code already exists.', tone: 'error' },
  promo_created: { text: 'Sale created.', tone: 'info' },
  promo_invalid: { text: 'Check the sale details: percent is 1–99, sale price looks like 9.99.', tone: 'error' },
  promo_dates: { text: 'The end date must be after the start date.', tone: 'error' },
};

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const context = await requireAdmin();
  const [codes, promotions, products] = await Promise.all([
    db.discountCode.findMany({ orderBy: { createdAt: 'desc' } }),
    db.promotion.findMany({ orderBy: { createdAt: 'desc' }, include: { product: { select: { name: true, priceCents: true } } } }),
    db.product.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const message = MESSAGES[(await searchParams).msg ?? ''];
  const now = new Date();

  return (
    <AdminShell context={context} title="Promotions">
      <Flash message={message?.text} tone={message?.tone} />

      <section className="card-pad mb-6">
        <h2 className="font-semibold text-white">Discount codes</h2>
        <p className="mt-1 text-sm text-zinc-400">Codes are case-insensitive and apply after any item sale prices.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Code</th><th>Discount</th><th>Min. order</th><th>Used</th><th>Expires</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code.id}>
                  <td className="font-mono">{code.codeNormalized}</td>
                  <td>{code.type === 'PERCENT' ? `${code.value}%` : formatCents(code.value)}</td>
                  <td>{code.minOrderCents ? formatCents(code.minOrderCents) : '—'}</td>
                  <td>{code.usedCount}{code.maxUses ? ` / ${code.maxUses}` : ''}</td>
                  <td>{day(code.expiresAt)}</td>
                  <td>{code.isActive ? <span className="pill border-emerald-400/40 text-emerald-200">active</span> : <span className="pill border-white/10 text-zinc-400">off</span>}</td>
                  <td>
                    <form action={toggleDiscountCode}>
                      <input type="hidden" name="id" value={code.id} />
                      <button type="submit" className="link text-xs">{code.isActive ? 'Disable' : 'Enable'}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={createDiscountCode} className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3 xl:grid-cols-7 xl:items-end">
          <div><label htmlFor="code" className="label">Code</label><input id="code" name="code" required maxLength={40} className="input uppercase" /></div>
          <div>
            <label htmlFor="type" className="label">Type</label>
            <select id="type" name="type" className="input"><option value="PERCENT">Percent off</option><option value="FIXED">Amount off ($)</option></select>
          </div>
          <div><label htmlFor="value" className="label">Value</label><input id="value" name="value" required placeholder="10 or 5.00" className="input" /></div>
          <div><label htmlFor="minOrder" className="label">Min. order ($)</label><input id="minOrder" name="minOrder" placeholder="optional" className="input" /></div>
          <div><label htmlFor="maxUses" className="label">Max uses</label><input id="maxUses" name="maxUses" type="number" min={1} placeholder="unlimited" className="input" /></div>
          <div><label htmlFor="expiresAt" className="label">Expires (UTC)</label><input id="expiresAt" name="expiresAt" type="date" className="input" /></div>
          <SubmitButton>Add code</SubmitButton>
        </form>
      </section>

      <section className="card-pad">
        <h2 className="font-semibold text-white">Item sales</h2>
        <p className="mt-1 text-sm text-zinc-400">If several sales apply to a product, the lowest price wins.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Product</th><th>Sale</th><th>Starts</th><th>Ends</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {promotions.map((promo) => {
                const live = promo.isActive && isWithinWindow(now, promo.startsAt, promo.endsAt);
                return (
                  <tr key={promo.id}>
                    <td>{promo.product.name}</td>
                    <td>{promo.type === 'PERCENT' ? `${promo.value}% off` : `${formatCents(promo.value)} (was ${formatCents(promo.product.priceCents)})`}</td>
                    <td>{day(promo.startsAt)}</td>
                    <td>{day(promo.endsAt)}</td>
                    <td>{live ? <span className="pill border-emerald-400/40 text-emerald-200">live</span> : <span className="pill border-white/10 text-zinc-400">{promo.isActive ? 'scheduled/ended' : 'off'}</span>}</td>
                    <td>
                      <form action={togglePromotion}>
                        <input type="hidden" name="id" value={promo.id} />
                        <button type="submit" className="link text-xs">{promo.isActive ? 'Disable' : 'Enable'}</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form action={createPromotion} className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3 xl:grid-cols-6 xl:items-end">
          <div>
            <label htmlFor="productId" className="label">Product</label>
            <select id="productId" name="productId" className="input">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </div>
          <div>
            <label htmlFor="promoType" className="label">Type</label>
            <select id="promoType" name="type" className="input"><option value="PERCENT">Percent off</option><option value="FIXED_PRICE">Sale price ($)</option></select>
          </div>
          <div><label htmlFor="promoValue" className="label">Value</label><input id="promoValue" name="value" required placeholder="20 or 9.99" className="input" /></div>
          <div><label htmlFor="startsAt" className="label">Starts (UTC)</label><input id="startsAt" name="startsAt" type="date" className="input" /></div>
          <div><label htmlFor="endsAt" className="label">Ends (UTC)</label><input id="endsAt" name="endsAt" type="date" className="input" /></div>
          <SubmitButton>Add sale</SubmitButton>
        </form>
      </section>
    </AdminShell>
  );
}
