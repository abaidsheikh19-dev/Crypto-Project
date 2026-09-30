import 'server-only';
import { cookies } from 'next/headers';
import { db } from './db';
import { hashToken, randomToken } from './crypto';
import { calculateTotals, type PricingResult, type PromotionRule } from './pricing';
import { getSettings } from './settings';
import { imageSrc } from './products';

export const CART_COOKIE = 'cart_token';
const CART_TTL_DAYS = 14;

const cartInclude = {
  discountCode: true,
  items: {
    orderBy: { id: 'asc' as const },
    include: {
      product: {
        include: { promotions: { where: { isActive: true } }, images: { orderBy: { sortOrder: 'asc' as const }, take: 1 } },
      },
    },
  },
};

async function readToken(): Promise<string | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export async function findCart() {
  const token = await readToken();
  if (!token) return null;
  return db.cart.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
    include: cartInclude,
  });
}

export type CartWithItems = NonNullable<Awaited<ReturnType<typeof findCart>>>;

const expiry = () => new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000);

/** Server actions only: may set the cart cookie. */
export async function getOrCreateCart(): Promise<CartWithItems> {
  const existing = await findCart();
  if (existing) {
    await db.cart.update({ where: { id: existing.id }, data: { expiresAt: expiry() } });
    return existing;
  }
  const token = randomToken();
  const cart = await db.cart.create({ data: { tokenHash: hashToken(token), expiresAt: expiry() }, include: cartInclude });
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CART_TTL_DAYS * 24 * 60 * 60,
  });
  return cart;
}

export async function clearCartCookie() {
  (await cookies()).delete(CART_COOKIE);
}

export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  image: string | null;
  quantity: number;
  stockQty: number;
  unitPriceCents: number;
  saleUnitPriceCents: number;
  lineTotalCents: number;
  onSale: boolean;
  /** Quantity exceeds what is in stock right now. */
  overStock: boolean;
};

export type CartView = {
  lines: CartLine[];
  totals: PricingResult;
  code: string | null;
  itemCount: number;
  canCheckout: boolean;
};

/** Prices everything from the database. Nothing from the client is trusted. */
export async function buildCartView(cart: CartWithItems | null): Promise<CartView> {
  const settings = await getSettings();
  const items = (cart?.items ?? []).filter((item) => item.product.isActive);
  const totals = calculateTotals({
    items: items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      unitPriceCents: item.product.priceCents,
      quantity: item.qty,
    })),
    promotions: items.flatMap((item) => item.product.promotions as PromotionRule[]),
    code: cart?.discountCode ?? null,
    shipping: { flatCents: settings.shipping_flat_cents, freeThresholdCents: settings.free_shipping_threshold_cents },
  });

  const lines = totals.lines.map((line, index): CartLine => {
    const product = items[index].product;
    return {
      productId: line.productId,
      slug: product.slug,
      name: line.name,
      image: product.images[0] ? imageSrc(product.images[0].fileKey) : null,
      quantity: line.quantity,
      stockQty: product.stockQty,
      unitPriceCents: line.unitPriceCents,
      saleUnitPriceCents: line.saleUnitPriceCents,
      lineTotalCents: line.lineTotalCents,
      onSale: line.onSale,
      overStock: line.quantity > product.stockQty,
    };
  });

  return {
    lines,
    totals,
    code: cart?.discountCode?.codeNormalized ?? null,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    canCheckout: lines.length > 0 && lines.every((line) => !line.overStock),
  };
}

export async function getCartView(): Promise<CartView> {
  return buildCartView(await findCart());
}

/** Set a line to an exact quantity (0 removes it), capped at available stock. */
export async function setCartQuantity(cartId: number, productId: number, quantity: number): Promise<'ok' | 'capped' | 'unavailable'> {
  const product = await db.product.findFirst({ where: { id: productId, isActive: true } });
  if (!product || product.stockQty <= 0) {
    await db.cartItem.deleteMany({ where: { cartId, productId } });
    return 'unavailable';
  }
  if (quantity <= 0) {
    await db.cartItem.deleteMany({ where: { cartId, productId } });
    return 'ok';
  }
  const qty = Math.min(quantity, product.stockQty, 99);
  await db.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, qty },
    update: { qty },
  });
  return qty < quantity ? 'capped' : 'ok';
}
