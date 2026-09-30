/**
 * Pricing engine. Pure functions, integer cents only, no I/O.
 *
 * Rules:
 * - Each product gets at most one item promotion: the active one that gives the
 *   lowest unit price. PERCENT promotions take whole percent off the unit price
 *   (rounded to the nearest cent); FIXED_PRICE promotions set the sale unit price.
 * - A discount code applies to the subtotal after item promotions, so the two
 *   stack. PERCENT codes round to the nearest cent; FIXED codes never exceed the
 *   subtotal.
 * - Shipping is a flat rate, free when the discounted subtotal reaches the
 *   free-shipping threshold, and zero for an empty cart.
 */

export type PromotionType = 'PERCENT' | 'FIXED_PRICE';
export type DiscountType = 'PERCENT' | 'FIXED';

export type PricingItem = {
  productId: number;
  name: string;
  unitPriceCents: number;
  quantity: number;
};

export type PromotionRule = {
  productId: number;
  type: PromotionType;
  value: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
};

export type DiscountCodeRule = {
  type: DiscountType;
  value: number;
  minOrderCents: number;
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: Date | null;
  isActive: boolean;
};

export type ShippingRule = {
  flatCents: number;
  freeThresholdCents?: number | null;
};

export type CodeStatus = 'none' | 'applied' | 'inactive' | 'expired' | 'exhausted' | 'below_minimum';

export type PricedLine = PricingItem & {
  saleUnitPriceCents: number;
  lineTotalCents: number;
  onSale: boolean;
};

export type PricingResult = {
  lines: PricedLine[];
  /** Sum of list prices, before any discount. */
  listSubtotalCents: number;
  /** Savings from item promotions. */
  itemSavingsCents: number;
  /** Subtotal after item promotions. */
  subtotalCents: number;
  codeStatus: CodeStatus;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
};

function assertCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer number of cents`);
  }
}

export function isWithinWindow(now: Date, startsAt?: Date | null, endsAt?: Date | null): boolean {
  if (startsAt && now < startsAt) return false;
  if (endsAt && now >= endsAt) return false;
  return true;
}

export function promotionUnitPrice(unitPriceCents: number, rule: PromotionRule): number {
  if (rule.type === 'PERCENT') {
    const percent = Math.min(Math.max(rule.value, 0), 100);
    return Math.max(0, unitPriceCents - Math.round((unitPriceCents * percent) / 100));
  }
  return Math.min(unitPriceCents, Math.max(0, rule.value));
}

export function bestUnitPrice(item: Pick<PricingItem, 'productId' | 'unitPriceCents'>, promotions: PromotionRule[], now: Date): number {
  return promotions
    .filter((rule) => rule.productId === item.productId && rule.isActive && isWithinWindow(now, rule.startsAt, rule.endsAt))
    .reduce((best, rule) => Math.min(best, promotionUnitPrice(item.unitPriceCents, rule)), item.unitPriceCents);
}

export function evaluateCode(code: DiscountCodeRule | null | undefined, subtotalCents: number, now: Date): { status: CodeStatus; discountCents: number } {
  if (!code) return { status: 'none', discountCents: 0 };
  if (!code.isActive) return { status: 'inactive', discountCents: 0 };
  if (code.expiresAt && now >= code.expiresAt) return { status: 'expired', discountCents: 0 };
  if (code.maxUses != null && code.usedCount >= code.maxUses) return { status: 'exhausted', discountCents: 0 };
  if (subtotalCents <= 0 || subtotalCents < code.minOrderCents) return { status: 'below_minimum', discountCents: 0 };

  const raw =
    code.type === 'PERCENT'
      ? Math.round((subtotalCents * Math.min(Math.max(code.value, 0), 100)) / 100)
      : Math.max(0, code.value);
  return { status: 'applied', discountCents: Math.min(raw, subtotalCents) };
}

export function calculateTotals(input: {
  items: PricingItem[];
  promotions?: PromotionRule[];
  code?: DiscountCodeRule | null;
  shipping: ShippingRule;
  now?: Date;
}): PricingResult {
  const now = input.now ?? new Date();
  const promotions = input.promotions ?? [];
  assertCents(input.shipping.flatCents, 'shipping.flatCents');

  const lines = input.items.map((item): PricedLine => {
    assertCents(item.unitPriceCents, `unit price of ${item.productId}`);
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new RangeError(`quantity of ${item.productId} must be a positive integer`);
    }
    const saleUnitPriceCents = bestUnitPrice(item, promotions, now);
    return {
      ...item,
      saleUnitPriceCents,
      lineTotalCents: saleUnitPriceCents * item.quantity,
      onSale: saleUnitPriceCents < item.unitPriceCents,
    };
  });

  const listSubtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const itemSavingsCents = listSubtotalCents - subtotalCents;
  const { status: codeStatus, discountCents } = evaluateCode(input.code, subtotalCents, now);
  const afterDiscount = subtotalCents - discountCents;

  const threshold = input.shipping.freeThresholdCents;
  const shippingCents =
    lines.length === 0 || (threshold != null && threshold > 0 && afterDiscount >= threshold) ? 0 : input.shipping.flatCents;

  return {
    lines,
    listSubtotalCents,
    itemSavingsCents,
    subtotalCents,
    codeStatus,
    discountCents,
    shippingCents,
    totalCents: afterDiscount + shippingCents,
  };
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
