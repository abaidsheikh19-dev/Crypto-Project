import Link from 'next/link';
import { StoreShell } from '@/src/components/store-shell';
import { Price } from '@/src/components/price';
import { getCatalog } from '@/src/lib/products';
import { addToCart } from './cart/actions';

export default async function CatalogPage() {
  const products = await getCatalog();

  return (
    <StoreShell>
      <section className="mb-10 rounded-[28px] border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(12,16,14,0.96)_55%)] p-6 md:p-10">
        <p className="eyebrow">Privacy-first essentials</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white md:text-5xl">Built for secure everyday carry.</h1>
        <p className="mt-4 max-w-xl text-zinc-300">
          Guest checkout, no trackers, no ads. Pay with Bitcoin, Lightning and more through our own BTCPay Server.
        </p>
      </section>

      <h2 className="sr-only">Products</h2>
      {products.length === 0 ? (
        <p className="card-pad text-zinc-300">No products are available right now.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => {
            const soldOut = product.stockQty === 0;
            return (
              <li key={product.id} className="card group flex flex-col overflow-hidden transition hover:border-emerald-400/40">
                <Link href={`/products/${product.slug}`} tabIndex={-1} aria-hidden className="relative block aspect-[4/3] overflow-hidden bg-zinc-900">
                  {product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.images[0].src} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  ) : null}
                  {product.saleUnitPriceCents < product.priceCents ? (
                    <span className="pill absolute left-3 top-3 border-emerald-400/40 bg-black/70 text-emerald-200">Sale</span>
                  ) : null}
                  {soldOut ? (
                    <span className="pill absolute right-3 top-3 border-red-500/40 bg-black/70 text-red-200">Out of stock</span>
                  ) : null}
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-lg font-semibold text-white">
                    <Link href={`/products/${product.slug}`} className="hover:text-emerald-200">{product.name}</Link>
                  </h3>
                  <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-6 text-zinc-400">{product.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Price priceCents={product.priceCents} saleCents={product.saleUnitPriceCents} badge={false} />
                    <form action={addToCart}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="quantity" value="1" />
                      <button type="submit" className="btn-primary px-3.5" disabled={soldOut} aria-label={`Add ${product.name} to cart`}>
                        Add
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </StoreShell>
  );
}
