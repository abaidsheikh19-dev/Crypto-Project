import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { AdminShell, Flash } from '@/src/components/admin-shell';
import { SubmitButton } from '@/src/components/submit-button';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { centsToDollarsInput } from '@/src/lib/money';
import { ProductForm } from '../product-form';
import { adjustStock, deleteProduct, updateProduct } from '../actions';

export const metadata: Metadata = { title: 'Edit product' };

const MESSAGES: Record<string, { text: string; tone: 'info' | 'warn' | 'error' }> = {
  created: { text: 'Product created.', tone: 'info' },
  saved: { text: 'Changes saved.', tone: 'info' },
  stock_saved: { text: 'Stock updated.', tone: 'info' },
  stock_invalid: { text: 'Enter a non-zero whole number and a reason.', tone: 'error' },
  stock_negative: { text: 'Stock cannot go below zero.', tone: 'error' },
  delete_confirm: { text: 'Type DELETE to confirm.', tone: 'error' },
};

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const context = await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse((await params).id);
  if (!id.success) notFound();
  const product = await db.product.findUnique({ where: { id: id.data }, include: { stockAdjustments: { orderBy: { createdAt: 'desc' }, take: 25 }, images: true } });
  if (!product) notFound();
  const adminIds = [...new Set(product.stockAdjustments.map((a) => a.adminUserId).filter((v): v is number => v !== null))];
  const admins = new Map((await db.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } })).map((a) => [a.id, a.email]));
  const message = MESSAGES[(await searchParams).msg ?? ''];

  return (
    <AdminShell context={context} title={product.name} actions={<><Link href={`/products/${product.slug}`} className="btn-ghost">View in shop</Link><Link href="/admin/products" className="btn-ghost">All products</Link></>}>
      <Flash message={message?.text} tone={message?.tone} />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <ProductForm
          action={updateProduct}
          submitLabel="Save changes"
          defaults={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            sku: product.sku,
            description: product.description,
            price: centsToDollarsInput(product.priceCents),
            lowStockThreshold: product.lowStockThreshold,
            sortOrder: product.sortOrder,
            isActive: product.isActive,
            isRestricted: product.isRestricted,
          }}
        />
        <div className="space-y-6">
          <section className="card-pad">
            <h2 className="font-semibold text-white">Stock: <span data-testid="stock-qty">{product.stockQty}</span></h2>
            <form action={adjustStock} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={product.id} />
              <div>
                <label htmlFor="delta" className="label">Change (e.g. 10 or -2)</label>
                <input id="delta" name="delta" type="number" required className="input" />
              </div>
              <div>
                <label htmlFor="reason" className="label">Reason</label>
                <input id="reason" name="reason" required maxLength={200} placeholder="New delivery, damaged, recount…" className="input" />
              </div>
              <SubmitButton className="btn-secondary w-full">Adjust stock</SubmitButton>
            </form>
            <h3 className="mb-2 mt-5 text-sm font-medium text-zinc-300">History</h3>
            {product.stockAdjustments.length === 0 ? <p className="text-sm text-zinc-500">No manual adjustments yet.</p> : (
              <ul className="space-y-2 text-xs text-zinc-400">
                {product.stockAdjustments.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span><span className={a.delta > 0 ? 'text-emerald-300' : 'text-red-300'}>{a.delta > 0 ? `+${a.delta}` : a.delta}</span> · {a.reason}</span>
                    <span className="text-right">{a.createdAt.toISOString().slice(0, 10)}<br />{a.adminUserId ? admins.get(a.adminUserId) ?? `admin #${a.adminUserId}` : 'system'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card-pad">
            <h2 className="font-semibold text-white">Delete product</h2>
            <p className="mt-1 text-sm text-zinc-400">Prefer unticking “Active” to archive it. Past orders keep their line items either way.</p>
            <form action={deleteProduct} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={product.id} />
              <label htmlFor="confirm" className="sr-only">Type DELETE to confirm</label>
              <input id="confirm" name="confirm" placeholder="Type DELETE" className="input" />
              <SubmitButton className="btn-danger">Delete</SubmitButton>
            </form>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
