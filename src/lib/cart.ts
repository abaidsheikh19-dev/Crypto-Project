import { cookies } from 'next/headers';
import { z } from 'zod';

const cartCookieName = 'store_cart';
const cartSchema = z.array(
  z.object({
    productId: z.string(),
    quantity: z.number().int().min(1).max(99),
  }),
);

export type CartEntry = { productId: string; quantity: number };

export function getCartCookieValue() {
  const cookieStore = cookies();
  const raw = cookieStore.get(cartCookieName)?.value ?? '[]';

  try {
    const parsed = JSON.parse(raw);
    const result = cartSchema.parse(parsed);
    return result;
  } catch {
    return [] as CartEntry[];
  }
}

export function setCartCookieValue(items: CartEntry[]) {
  const cookieStore = cookies();
  cookieStore.set(cartCookieName, JSON.stringify(items), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}
