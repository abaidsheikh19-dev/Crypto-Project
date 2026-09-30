import 'server-only';
import { db } from './db';
import { bestUnitPrice, type PromotionRule } from './pricing';

export type CatalogProduct = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  description: string;
  priceCents: number;
  saleUnitPriceCents: number;
  stockQty: number;
  images: { src: string; alt: string }[];
};

const productInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  promotions: { where: { isActive: true } },
};

type ProductWithRelations = Awaited<ReturnType<typeof loadActive>>[number];

function loadActive() {
  return db.product.findMany({
    where: { isActive: true },
    include: productInclude,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
}

export function imageSrc(fileKey: string): string {
  // Seeded placeholders live in /public; uploaded files will be served by the
  // app from private storage under the same `/media/` style key.
  return fileKey.startsWith('/') ? fileKey : `/${fileKey}`;
}

function toCatalog(product: ProductWithRelations, now: Date): CatalogProduct {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    saleUnitPriceCents: bestUnitPrice({ productId: product.id, unitPriceCents: product.priceCents }, product.promotions as PromotionRule[], now),
    stockQty: product.stockQty,
    images: product.images.map((image) => ({ src: imageSrc(image.fileKey), alt: image.altText || product.name })),
  };
}

export async function getCatalog(): Promise<CatalogProduct[]> {
  const now = new Date();
  return (await loadActive()).map((product) => toCatalog(product, now));
}

export async function getCatalogProduct(slug: string): Promise<CatalogProduct | null> {
  const product = await db.product.findFirst({ where: { slug, isActive: true }, include: productInclude });
  return product ? toCatalog(product, new Date()) : null;
}
