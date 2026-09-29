import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { orderSchema } from '@/src/lib/validators';
import { getCartCookieValue, setCartCookieValue } from '@/src/lib/cart';
import { createOrderRecord } from '@/src/lib/orders';

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
    city: String(formData.get('city') ?? ''),
    postcode: String(formData.get('postcode') ?? ''),
    country: String(formData.get('country') ?? ''),
  };

  const parsed = orderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.redirect(new URL('/checkout', process.env.APP_URL ?? 'http://localhost:3000'));
  }

  const items = getCartCookieValue();
  if (items.length === 0) {
    return NextResponse.redirect(new URL('/cart', process.env.APP_URL ?? 'http://localhost:3000'));
  }

  const token = randomUUID();
  const order = createOrderRecord({
    id: `ORD-${Math.floor(Math.random() * 90000 + 10000)}`,
    token,
    status: 'pending_payment',
    totalCents: 4100,
    email: parsed.data.email,
  });

  setCartCookieValue([]);
  return NextResponse.redirect(new URL(`/status/${order.token}`, process.env.APP_URL ?? 'http://localhost:3000'));
}
