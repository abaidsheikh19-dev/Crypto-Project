import { NextResponse } from 'next/server';
import { cartItemSchema } from '@/src/lib/validators';
import { getCartCookieValue, setCartCookieValue } from '@/src/lib/cart';

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload = {
    productId: String(formData.get('productId') ?? ''),
    quantity: Number(formData.get('quantity') ?? 1),
  };

  const parsed = cartItemSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.redirect(new URL('/catalog', process.env.APP_URL ?? 'http://localhost:3000'));
  }

  const current = getCartCookieValue();
  const existing = current.find((item) => item.productId === parsed.data.productId);

  const next = existing
    ? current.map((item) =>
        item.productId === parsed.data.productId ? { ...item, quantity: parsed.data.quantity } : item,
      )
    : [...current, { productId: parsed.data.productId, quantity: parsed.data.quantity }];

  setCartCookieValue(next);
  return NextResponse.redirect(new URL('/cart', process.env.APP_URL ?? 'http://localhost:3000'));
}
