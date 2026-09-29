export type PromotionType = 'fixed' | 'percent';

export type CartItemInput = {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
};

export type PromotionRule = {
  productId: string;
  type: PromotionType;
  value: number;
  startsAt?: Date;
  endsAt?: Date;
};

export type DiscountCodeRule = {
  type: PromotionType;
  value: number;
  minOrderCents: number;
  expiresAt?: Date;
  maxUses?: number;
  usedCount?: number;
};

export type PricingContext = {
  items: CartItemInput[];
  promotions?: PromotionRule[];
  shippingCents: number;
  code?: DiscountCodeRule;
};

export type PricingTotals = {
  subtotalCents: number;
  promotionDiscountCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
};

function isInDateWindow(start?: Date, end?: Date, now = new Date()) {
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

function applyProductPromotions(items: CartItemInput[], promotions: PromotionRule[] = []) {
  return items.map((item) => {
    const promotion = promotions.find(
      (rule) => rule.productId === item.productId && isInDateWindow(rule.startsAt, rule.endsAt),
    );

    if (!promotion) {
      return { ...item, discountCents: 0 };
    }

    if (promotion.type === 'fixed') {
      return {
        ...item,
        discountCents: Math.min(item.unitPriceCents * item.quantity, promotion.value * item.quantity),
      };
    }

    const discount = Math.round((item.unitPriceCents * item.quantity * promotion.value) / 100);
    return { ...item, discountCents: discount };
  });
}

function calculateCodeDiscount(subtotalCents: number, code?: DiscountCodeRule) {
  if (!code) return 0;
  if (code.minOrderCents > subtotalCents) return 0;
  if (code.expiresAt && new Date() > code.expiresAt) return 0;
  if (code.maxUses && (code.usedCount ?? 0) >= code.maxUses) return 0;

  if (code.type === 'fixed') {
    return Math.min(code.value, subtotalCents);
  }

  return Math.round((subtotalCents * code.value) / 100);
}

export function calculateTotals(context: PricingContext): PricingTotals {
  const effectiveItems = applyProductPromotions(context.items, context.promotions);
  const subtotalCents = effectiveItems.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  );
  const promotionDiscountCents = effectiveItems.reduce((sum, item) => sum + (item.discountCents ?? 0), 0);
  const codeDiscount = calculateCodeDiscount(subtotalCents - promotionDiscountCents, context.code);
  const shippingCents = context.shippingCents ?? 0;
  const totalCents = Math.max(0, subtotalCents - codeDiscount + shippingCents);

  return {
    subtotalCents,
    promotionDiscountCents,
    discountCents: codeDiscount,
    shippingCents,
    totalCents,
  };
}
