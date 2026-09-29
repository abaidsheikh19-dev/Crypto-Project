import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPriceCents, getProductBySlug } from '@/src/lib/products';

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen px-6 py-8 text-zinc-100 md:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/catalog" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-300">
          ← Back to catalog
        </Link>

        <div className="grid gap-8 rounded-3xl border border-emerald-500/20 bg-ink-900/80 p-4 shadow-2xl shadow-black/20 md:grid-cols-2 md:p-6">
          <div className="relative h-[500px] overflow-hidden rounded-2xl border border-emerald-500/20 bg-zinc-900">
            <Image src={product.image} alt={product.name} fill className="object-cover" unoptimized />
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400">Product</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">{product.name}</h1>
            <p className="mt-5 text-3xl font-bold text-emerald-300">{formatPriceCents(product.priceCents)}</p>
            <p className="mt-5 max-w-lg text-base leading-7 text-zinc-300">{product.description}</p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5">
                {product.stockQty > 0 ? `${product.stockQty} available` : 'Out of stock'}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1.5">SKU: {product.sku}</span>
            </div>

            <form action="/api/cart" method="post" className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <input type="hidden" name="productId" value={product.id} />
              <label className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-black/20 px-3 py-2.5 text-sm text-zinc-200">
                Qty
                <input
                  type="number"
                  name="quantity"
                  min={1}
                  max={product.stockQty || 1}
                  defaultValue={1}
                  className="w-16 bg-transparent text-center text-white outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={product.stockQty === 0}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-base font-semibold text-ink-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add to cart
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
