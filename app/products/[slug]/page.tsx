import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StoreShell } from '@/src/components/store-shell';
import { Price } from '@/src/components/price';
import { getCatalogProduct } from '@/src/lib/products';
import { slugSchema } from '@/src/lib/validators';
import { addToCart } from '../../cart/actions';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ image?: string }> };

async function load(slug: string) {
  const parsed = slugSchema.safeParse(slug);
  return parsed.success ? getCatalogProduct(parsed.data) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await load((await params).slug);
  return { title: product?.name ?? 'Product not found' };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const product = await load((await params).slug);
  if (!product) notFound();

  const imageIndex = Math.min(Math.max(Number((await searchParams).image) || 0, 0), Math.max(product.images.length - 1, 0));
  const image = product.images[imageIndex];
  const soldOut = product.stockQty === 0;

  return (
    <StoreShell>
      <Link href="/" className="link mb-6 inline-block text-sm">← Back to shop</Link>

      <div className="card grid gap-8 p-4 md:grid-cols-2 md:p-6">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl border border-emerald-500/20 bg-zinc-900">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
            ) : null}
          </div>
          {product.images.length > 1 ? (
            <ul className="mt-3 flex gap-2" aria-label="More images">
              {product.images.map((thumb, index) => (
                <li key={thumb.src}>
                  <Link
                    href={`?image=${index}`}
                    scroll={false}
                    aria-current={index === imageIndex}
                    className={`block h-16 w-16 overflow-hidden rounded-xl border ${index === imageIndex ? 'border-emerald-400' : 'border-white/10'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb.src} alt={`${product.name} image ${index + 1}`} className="h-full w-full object-cover" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col justify-center">
          <p className="eyebrow">SKU {product.sku}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">{product.name}</h1>
          <div className="mt-4"><Price priceCents={product.priceCents} saleCents={product.saleUnitPriceCents} size="lg" /></div>
          <p className="mt-5 whitespace-pre-line leading-7 text-zinc-300">{product.description}</p>

          <p className="mt-6 text-sm">
            {soldOut ? (
              <span className="pill border-red-500/40 bg-red-500/10 text-red-200">Out of stock</span>
            ) : (
              <span className="pill border-emerald-500/30 bg-emerald-500/10 text-emerald-200">{product.stockQty} in stock</span>
            )}
          </p>

          <form action={addToCart} className="mt-6 flex flex-wrap items-end gap-3">
            <input type="hidden" name="productId" value={product.id} />
            <div>
              <label htmlFor="quantity" className="label">Quantity</label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                max={Math.max(1, Math.min(product.stockQty, 99))}
                defaultValue={1}
                disabled={soldOut}
                className="input w-24 text-center"
              />
            </div>
            <button type="submit" className="btn-primary px-6 py-3 text-base" disabled={soldOut}>
              Add to cart
            </button>
          </form>
        </div>
      </div>
    </StoreShell>
  );
}
