'use server';

import { redirect } from 'next/navigation';
import { db } from '@/src/lib/db';
import { buildCartView, findCart } from '@/src/lib/cart';
import { encrypt } from '@/src/lib/crypto';
import { readCheckoutDraft } from '@/src/lib/checkout-draft';
import { checkoutDetailsSchema, type CheckoutDetails } from '@/src/lib/validators';
import { consumeRateLimit } from '@/src/lib/rate-limit';
import { clientIpHash, requestOrigin } from '@/src/lib/request';
import { CheckoutError, placeOrder } from '@/src/lib/orders';

export type DetailsFormState = {
  errors?: Partial<Record<keyof CheckoutDetails | 'form', string>>;
  values?: Partial<Record<keyof CheckoutDetails, string>>;
};

const FIELDS = ['email', 'name', 'addressLine1', 'addressLine2', 'city', 'region', 'postcode', 'country'] as const;

export async function saveCheckoutDetails(_prev: DetailsFormState, formData: FormData): Promise<DetailsFormState> {
  const values = Object.fromEntries(FIELDS.map((field) => [field, String(formData.get(field) ?? '').slice(0, 300)])) as Record<
    (typeof FIELDS)[number],
    string
  >;

  if (!(await consumeRateLimit('checkout', await clientIpHash()))) {
    return { values, errors: { form: 'Too many attempts. Please wait a few minutes and try again.' } };
  }

  const parsed = checkoutDetailsSchema.safeParse(values);
  if (!parsed.success) {
    const errors: DetailsFormState['errors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof CheckoutDetails;
      errors[key] ??= issue.message === 'Required' ? 'This field is required' : issue.message;
    }
    return { values, errors };
  }

  const cart = await findCart();
  if (!cart) redirect('/cart');
  const view = await buildCartView(cart);
  if (!view.canCheckout) redirect('/cart');

  // The draft is encrypted like every other personal-data field and dropped
  // when the order is placed or the cart expires.
  await db.cart.update({ where: { id: cart.id }, data: { checkoutDraftEnc: encrypt(JSON.stringify(parsed.data)) } });
  redirect('/checkout/review');
}

export async function payNow() {
  if (!(await consumeRateLimit('checkout', await clientIpHash()))) redirect('/checkout/review?error=slow_down');

  const cart = await findCart();
  if (!cart) redirect('/cart');
  const details = readCheckoutDraft(cart.checkoutDraftEnc);
  if (!details) redirect('/checkout');

  let destination: string;
  try {
    const result = await placeOrder({ cartId: cart.id, details, origin: await requestOrigin() });
    destination = result.checkoutUrl;
  } catch (error) {
    if (error instanceof CheckoutError) {
      if (error.code === 'payment_unavailable') redirect('/checkout/review?error=payment_unavailable');
      redirect(`/cart?notice=${error.code}`);
    }
    throw error;
  }
  redirect(destination);
}
