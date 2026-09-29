import { describe, expect, it } from 'vitest';
import {
  calculateTotals,
  type CartItemInput,
  type DiscountCodeRule,
  type PromotionRule,
  type PricingContext,
} from '../src/lib/pricing';

describe('pricing engine', () => {
  it('applies item promotions and shipping totals in integer cents', () => {
    const items: CartItemInput[] = [
      { productId: 'pen', name: 'Reusable Pen', unitPriceCents: 1500, quantity: 2 },
      { productId: 'refill', name: 'Ink Refill', unitPriceCents: 800, quantity: 1 },
    ];

    const promotions: PromotionRule[] = [
      { productId: 'pen', type: 'fixed', value: 200, startsAt: new Date('2020-01-01'), endsAt: new Date('2030-01-01') },
    ];

    const context: PricingContext = {
      items,
      promotions,
      shippingCents: 500,
      code: { type: 'fixed', value: 300, minOrderCents: 0 },
    };

    const totals = calculateTotals(context);

    expect(totals.subtotalCents).toBe(3800);
    expect(totals.discountCents).toBe(300);
    expect(totals.shippingCents).toBe(500);
    expect(totals.totalCents).toBe(4000);
  });

  it('rejects expired or invalid discount codes', () => {
    const items: CartItemInput[] = [{ productId: 'pen', name: 'Reusable Pen', unitPriceCents: 1500, quantity: 1 }];

    const expired: DiscountCodeRule = { type: 'percent', value: 10, minOrderCents: 0, expiresAt: new Date('2000-01-01') };
    const valid: DiscountCodeRule = { type: 'percent', value: 10, minOrderCents: 0 };

    expect(calculateTotals({ items, shippingCents: 0, code: expired }).discountCents).toBe(0);
    expect(calculateTotals({ items, shippingCents: 0, code: valid }).discountCents).toBe(150);
  });
});
