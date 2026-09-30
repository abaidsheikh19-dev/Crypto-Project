import Link from 'next/link';
import type { Metadata } from 'next';
import { AdminShell, Flash } from '@/src/components/admin-shell';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { formatCents } from '@/src/lib/pricing';

export const metadata: Metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const context = await requireAdmin();
  const products = await db.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  const msg = (await searchParams).msg;

  return (
    <AdminShell context={context} title="Products" actions={<Link href="/admin/products/new" className="btn-primary">New product</Link>}>
      <Flash message={msg === 'deleted' ? 'Product deleted.' : null} />
      <div className="card overflow-x-auto p-2">
        <table className="table">
          <thead><tr><th>Name</th><th>SKU</th><th className="text-right">Price</th><th className="text-right">Stock</th><th>Status</th></tr></thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td><Link href={`/admin/products/${product.id}`} className="link">{product.name}</Link></td>
                <td className="font-mono text-xs">{product.sku}</td>
                <td className="text-right">{formatCents(product.priceCents)}</td>
                <td className={`text-right ${product.stockQty <= product.lowStockThreshold ? 'text-amber-200' : ''}`}>{product.stockQty}</td>
                <td className="space-x-1">
                  {product.isActive ? <span className="pill border-emerald-400/40 text-emerald-200">active</span> : <span className="pill border-white/10 text-zinc-400">archived</span>}
                  {product.isRestricted ? <span className="pill border-white/10 text-zinc-400">restricted</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
