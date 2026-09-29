import Image from 'next/image';
import Link from 'next/link';
import { formatPriceCents, getProducts } from '@/src/lib/products';

export default function CatalogPage() {
  const products = getProducts();

  return (
    <main className="min-h-screen px-6 py-8 text-zinc-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_35%),linear-gradient(135deg,_rgba(13,23,19,0.95),_rgba(9,17,14,0.9))] px-5 py-4 shadow-[0_18px_40px_rgba(5,11,8,0.45)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.45em] text-emerald-400">
                Crypto Store
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Catalog</h1>
            </div>
            <nav className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
              <Link href="/catalog" className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-200 shadow-inner shadow-emerald-950/40">
                Catalog
              </Link>
              <Link href="/cart" className="rounded-full border border-white/10 px-3 py-1.5 transition hover:border-emerald-500/30 hover:text-white">
                Cart
              </Link>
              <Link href="/checkout" className="rounded-full border border-white/10 px-3 py-1.5 transition hover:border-emerald-500/30 hover:text-white">
                Checkout
              </Link>
              <Link href="/admin/login" className="rounded-full border border-white/10 px-3 py-1.5 transition hover:border-emerald-500/30 hover:text-white">
                Admin
              </Link>
            </nav>
          </div>
        </header>

        <section className="mb-8 rounded-[30px] border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(12,16,14,0.96),rgba(12,16,14,0.96))] p-6 shadow-[0_20px_60px_rgba(16,185,129,0.08)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Privacy-first essentials</p>
              <h2 className="mt-2 text-4xl font-bold tracking-tight text-white">Built for secure everyday carry.</h2>
            </div>
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
              BTC, Lightning, and more in checkout
            </div>
          </div>
        </section>

        <div className="grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
            <article key={product.id} className="group overflow-hidden rounded-[24px] border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(12,16,14,0.96),rgba(10,15,12,0.94))] shadow-[0_18px_38px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-[0_22px_42px_rgba(16,185,129,0.12)]">
              <div className="relative h-56 w-full overflow-hidden bg-zinc-900">
                <Image src={product.image} alt={product.name} fill className="object-cover transition duration-500 group-hover:scale-105" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {product.stockQty === 0 ? (
                  <span className="absolute right-3 top-3 rounded-full border border-red-500/40 bg-black/55 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-red-300">
                    Sold out
                  </span>
                ) : null}
              </div>

              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white">{product.name}</h2>
                </div>
                <p className="mb-4 min-h-[48px] text-sm leading-6 text-zinc-300">{product.description}</p>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-2xl font-bold text-emerald-300">{formatPriceCents(product.priceCents)}</span>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                    {product.stockQty} left
                  </span>
                </div>
                <div className="flex gap-3">
                  <Link
                    href={`/products/${product.slug}`}
                    className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-center text-sm font-medium text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/10"
                  >
                    View item
                  </Link>
                  <form action="/api/cart" method="post">
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="quantity" value="1" />
                    <button
                      type="submit"
                      disabled={product.stockQty === 0}
                      className="rounded-xl bg-emerald-500 px-3.5 py-2.5 text-sm font-semibold text-ink-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Add
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
