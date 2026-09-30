'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/src/lib/db';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { audit } from '@/src/lib/audit';
import { parseDollarsToCents } from '@/src/lib/money';
import { clientIpHash } from '@/src/lib/request';
import { slugSchema } from '@/src/lib/validators';

const PLACEHOLDER_IMAGE = 'images/products/placeholder.svg';

export type ProductFormState = { error?: string; fieldErrors?: Record<string, string> };

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().max(80).optional().default(''),
  sku: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9-]+$/, 'Letters, numbers and dashes only'),
  description: z.string().trim().max(4000),
  price: z.string().transform((value, ctx) => {
    const cents = parseDollarsToCents(value);
    if (cents === null || cents < 1) {
      ctx.addIssue({ code: 'custom', message: 'Enter a price like 12.50' });
      return z.NEVER;
    }
    return cents;
  }),
  lowStockThreshold: z.coerce.number().int().min(0).max(100_000),
  sortOrder: z.coerce.number().int().min(-10_000).max(10_000),
  isActive: z.boolean(),
  isRestricted: z.boolean(),
});

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function read(formData: FormData) {
  const parsed = productSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug') ?? '',
    sku: formData.get('sku'),
    description: formData.get('description') ?? '',
    price: String(formData.get('price') ?? ''),
    lowStockThreshold: formData.get('lowStockThreshold'),
    sortOrder: formData.get('sortOrder') ?? 0,
    isActive: formData.get('isActive') === 'on',
    isRestricted: formData.get('isRestricted') === 'on',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: { fieldErrors } as ProductFormState };
  }
  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slugSchema.safeParse(slug).success) return { error: { fieldErrors: { slug: 'Use lowercase letters, numbers and dashes' } } };
  return { data: { ...parsed.data, slug } };
}

function uniqueError(error: unknown): ProductFormState | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return { error: 'Another product already uses that slug or SKU.' };
  }
  return null;
}

export async function createProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const { admin } = await requireAdmin();
  const result = read(formData);
  if (result.error) return result.error;
  const { price, ...rest } = result.data;
  const initialStock = z.coerce.number().int().min(0).max(100_000).catch(0).parse(formData.get('stockQty'));

  let id: number;
  try {
    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { ...rest, priceCents: price, stockQty: initialStock, images: { create: { fileKey: PLACEHOLDER_IMAGE, altText: rest.name } } },
      });
      if (initialStock > 0) {
        await tx.stockAdjustment.create({ data: { productId: created.id, delta: initialStock, reason: 'Initial stock', adminUserId: admin.id } });
      }
      return created;
    });
    id = product.id;
  } catch (error) {
    const known = uniqueError(error);
    if (known) return known;
    throw error;
  }
  await audit({ type: 'admin', id: admin.id }, 'product.created', { type: 'product', id }, { priceCents: price, stockQty: initialStock }, { ipHash: await clientIpHash() });
  redirect(`/admin/products/${id}?msg=created`);
}

export async function updateProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const { admin } = await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get('id'));
  if (!id.success) return { error: 'Unknown product.' };
  const result = read(formData);
  if (result.error) return result.error;
  const before = await db.product.findUnique({ where: { id: id.data } });
  if (!before) return { error: 'Unknown product.' };
  const { price, ...rest } = result.data;

  try {
    await db.product.update({ where: { id: id.data }, data: { ...rest, priceCents: price } });
  } catch (error) {
    const known = uniqueError(error);
    if (known) return known;
    throw error;
  }
  const changed = (Object.keys(rest) as (keyof typeof rest)[]).filter((key) => before[key] !== rest[key]);
  if (before.priceCents !== price) changed.push('priceCents' as never);
  await audit(
    { type: 'admin', id: admin.id },
    'product.updated',
    { type: 'product', id: id.data },
    { changed, ...(before.priceCents !== price ? { priceFrom: before.priceCents, priceTo: price } : {}) },
    { ipHash: await clientIpHash() },
  );
  redirect(`/admin/products/${id.data}?msg=saved`);
}

export async function adjustStock(formData: FormData) {
  const { admin } = await requireAdmin();
  const parsed = z
    .object({
      id: z.coerce.number().int().positive(),
      delta: z.coerce.number().int().min(-100_000).max(100_000).refine((n) => n !== 0),
      reason: z.string().trim().min(2).max(200),
    })
    .safeParse({ id: formData.get('id'), delta: formData.get('delta'), reason: formData.get('reason') });
  if (!parsed.success) redirect(`/admin/products/${formData.get('id')}?msg=stock_invalid`);
  const { id, delta, reason } = parsed.data;

  const applied = await db.$transaction(async (tx) => {
    // Never let stock go below zero, even if an order reserves units meanwhile.
    const updated = await tx.product.updateMany({
      where: { id, ...(delta < 0 ? { stockQty: { gte: -delta } } : {}) },
      data: { stockQty: { increment: delta } },
    });
    if (updated.count !== 1) return false;
    await tx.stockAdjustment.create({ data: { productId: id, delta, reason, adminUserId: admin.id } });
    return true;
  });
  if (applied) await audit({ type: 'admin', id: admin.id }, 'stock.adjusted', { type: 'product', id }, { delta }, { ipHash: await clientIpHash() });
  redirect(`/admin/products/${id}?msg=${applied ? 'stock_saved' : 'stock_negative'}`);
}

export async function deleteProduct(formData: FormData) {
  const { admin } = await requireAdmin();
  const parsed = z.object({ id: z.coerce.number().int().positive(), confirm: z.literal('DELETE') }).safeParse({ id: formData.get('id'), confirm: formData.get('confirm') });
  if (!parsed.success) redirect(`/admin/products/${formData.get('id')}?msg=delete_confirm`);
  // Order lines keep their name/price snapshot; only the link to the product is cleared.
  await db.product.delete({ where: { id: parsed.data.id } });
  await audit({ type: 'admin', id: admin.id }, 'product.deleted', { type: 'product', id: parsed.data.id }, undefined, { ipHash: await clientIpHash() });
  redirect('/admin/products?msg=deleted');
}
