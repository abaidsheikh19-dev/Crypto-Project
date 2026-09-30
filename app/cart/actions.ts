'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/src/lib/db';
import { buildCartView, findCart, getOrCreateCart, setCartQuantity } from '@/src/lib/cart';
import { cartMutationSchema, discountCodeInputSchema, productIdSchema } from '@/src/lib/validators';
import { consumeRateLimit } from '@/src/lib/rate-limit';
import { clientIpHash } from '@/src/lib/request';
import { evaluateCode, normalizeCode } from '@/src/lib/pricing';

// Every action validates its input with Zod and works only on the cart named
// by this browser's HttpOnly cookie, so one visitor can never touch another's
// cart. Prices are never read from the form.

async function limited() {
  return !(await consumeRateLimit('cart', await clientIpHash()));
}

export async function addToCart(formData: FormData) {
  const parsed = cartMutationSchema.extend({ quantity: z.coerce.number().int().min(1).max(99) }).safeParse({
    productId: formData.get('productId'),
    quantity: formData.get('quantity') ?? 1,
  });
  if (!parsed.success) redirect('/cart?notice=invalid');
  if (await limited()) redirect('/cart?notice=slow_down');

  const cart = await getOrCreateCart();
  const existing = cart.items.find((item) => item.productId === parsed.data.productId)?.qty ?? 0;
  const result = await setCartQuantity(cart.id, parsed.data.productId, existing + parsed.data.quantity);
  redirect(result === 'ok' ? '/cart?notice=added' : `/cart?notice=${result}`);
}

export async function updateQuantity(formData: FormData) {
  const parsed = cartMutationSchema.safeParse({ productId: formData.get('productId'), quantity: formData.get('quantity') });
  if (!parsed.success) redirect('/cart?notice=invalid');
  if (await limited()) redirect('/cart?notice=slow_down');

  const cart = await findCart();
  if (!cart) redirect('/cart');
  const result = await setCartQuantity(cart.id, parsed.data.productId, parsed.data.quantity);
  redirect(result === 'ok' ? '/cart' : `/cart?notice=${result}`);
}

export async function removeItem(formData: FormData) {
  const productId = productIdSchema.safeParse(formData.get('productId'));
  if (!productId.success) redirect('/cart?notice=invalid');
  const cart = await findCart();
  if (cart) await db.cartItem.deleteMany({ where: { cartId: cart.id, productId: productId.data } });
  redirect('/cart');
}

export async function applyDiscountCode(formData: FormData) {
  const parsed = discountCodeInputSchema.safeParse({ code: formData.get('code') });
  if (!parsed.success) redirect('/cart?code=invalid');
  // Separate, tighter limit so codes cannot be brute-forced.
  if (!(await consumeRateLimit('discountCode', await clientIpHash()))) redirect('/cart?code=slow_down');

  const cart = await findCart();
  if (!cart || cart.items.length === 0) redirect('/cart');

  const code = await db.discountCode.findUnique({ where: { codeNormalized: normalizeCode(parsed.data.code) } });
  if (!code) redirect('/cart?code=invalid');

  const view = await buildCartView(cart);
  const { status } = evaluateCode(code, view.totals.subtotalCents, new Date());
  if (status === 'below_minimum') redirect('/cart?code=below_minimum');
  // Expired, used-up, inactive and unknown codes all get the same answer.
  if (status !== 'applied') redirect('/cart?code=invalid');

  await db.cart.update({ where: { id: cart.id }, data: { discountCodeId: code.id } });
  redirect('/cart?code=applied');
}

export async function removeDiscountCode() {
  const cart = await findCart();
  if (cart) await db.cart.update({ where: { id: cart.id }, data: { discountCodeId: null } });
  redirect('/cart');
}
