'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/src/lib/db';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { audit } from '@/src/lib/audit';
import { parseDollarsToCents } from '@/src/lib/money';
import { normalizeCode } from '@/src/lib/pricing';
import { clientIpHash } from '@/src/lib/request';

const optionalDate = z
  .string()
  .optional()
  .transform((value) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null));

const dollars = (label: string) =>
  z.string().transform((value, ctx) => {
    if (!value.trim()) return 0;
    const cents = parseDollarsToCents(value);
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: `${label} must be an amount like 5.00` });
      return z.NEVER;
    }
    return cents;
  });

export async function createDiscountCode(formData: FormData) {
  const { admin } = await requireAdmin();
  const parsed = z
    .object({
      code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
      type: z.enum(['PERCENT', 'FIXED']),
      value: z.string(),
      minOrder: dollars('Minimum order'),
      maxUses: z.string().transform((v) => (v.trim() ? Number(v) : null)).pipe(z.number().int().min(1).max(1_000_000).nullable()),
      expiresAt: optionalDate,
    })
    .safeParse(Object.fromEntries(['code', 'type', 'value', 'minOrder', 'maxUses', 'expiresAt'].map((k) => [k, String(formData.get(k) ?? '')])));
  if (!parsed.success) redirect('/admin/promotions?msg=code_invalid');
  const { code, type, minOrder, maxUses, expiresAt } = parsed.data;
  const value = type === 'PERCENT' ? Number(parsed.data.value) : parseDollarsToCents(parsed.data.value);
  if (value === null || !Number.isInteger(value) || value < 1 || (type === 'PERCENT' && value > 100)) redirect('/admin/promotions?msg=code_invalid');

  try {
    const created = await db.discountCode.create({
      data: { codeNormalized: normalizeCode(code), type, value, minOrderCents: minOrder, maxUses, expiresAt },
    });
    await audit({ type: 'admin', id: admin.id }, 'promo.code_created', { type: 'discount_code', id: created.id }, { type, value, maxUses }, { ipHash: await clientIpHash() });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') redirect('/admin/promotions?msg=code_exists');
    throw error;
  }
  redirect('/admin/promotions?msg=code_created');
}

export async function toggleDiscountCode(formData: FormData) {
  const { admin } = await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get('id'));
  if (!id.success) redirect('/admin/promotions');
  const code = await db.discountCode.findUnique({ where: { id: id.data } });
  if (!code) redirect('/admin/promotions');
  await db.discountCode.update({ where: { id: code.id }, data: { isActive: !code.isActive } });
  await audit({ type: 'admin', id: admin.id }, code.isActive ? 'promo.code_disabled' : 'promo.code_enabled', { type: 'discount_code', id: code.id }, undefined, { ipHash: await clientIpHash() });
  redirect('/admin/promotions');
}

export async function createPromotion(formData: FormData) {
  const { admin } = await requireAdmin();
  const parsed = z
    .object({
      productId: z.coerce.number().int().positive(),
      type: z.enum(['PERCENT', 'FIXED_PRICE']),
      value: z.string(),
      startsAt: optionalDate,
      endsAt: optionalDate,
    })
    .safeParse(Object.fromEntries(['productId', 'type', 'value', 'startsAt', 'endsAt'].map((k) => [k, String(formData.get(k) ?? '')])));
  if (!parsed.success) redirect('/admin/promotions?msg=promo_invalid');
  const { productId, type, startsAt, endsAt } = parsed.data;
  const value = type === 'PERCENT' ? Number(parsed.data.value) : parseDollarsToCents(parsed.data.value);
  if (value === null || !Number.isInteger(value) || value < (type === 'PERCENT' ? 1 : 0) || (type === 'PERCENT' && value > 99)) redirect('/admin/promotions?msg=promo_invalid');
  if (startsAt && endsAt && endsAt <= startsAt) redirect('/admin/promotions?msg=promo_dates');
  if (!(await db.product.findUnique({ where: { id: productId } }))) redirect('/admin/promotions?msg=promo_invalid');

  const created = await db.promotion.create({ data: { productId, type, value, startsAt, endsAt } });
  await audit({ type: 'admin', id: admin.id }, 'promo.sale_created', { type: 'promotion', id: created.id }, { productId, type, value }, { ipHash: await clientIpHash() });
  redirect('/admin/promotions?msg=promo_created');
}

export async function togglePromotion(formData: FormData) {
  const { admin } = await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get('id'));
  if (!id.success) redirect('/admin/promotions');
  const promo = await db.promotion.findUnique({ where: { id: id.data } });
  if (!promo) redirect('/admin/promotions');
  await db.promotion.update({ where: { id: promo.id }, data: { isActive: !promo.isActive } });
  await audit({ type: 'admin', id: admin.id }, promo.isActive ? 'promo.sale_disabled' : 'promo.sale_enabled', { type: 'promotion', id: promo.id }, undefined, { ipHash: await clientIpHash() });
  redirect('/admin/promotions');
}
