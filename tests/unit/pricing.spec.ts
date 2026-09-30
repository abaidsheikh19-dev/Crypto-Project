import { describe, expect, it } from 'vitest';
import {
  bestUnitPrice,
  calculateTotals,
  evaluateCode,
  formatCents,
  isWithinWindow,
  normalizeCode,
  promotionUnitPrice,
  type DiscountCodeRule,
  type PricingItem,
  type PromotionRule,
} from '../../src/lib/pricing';

const now = new Date('2026-06-15T12:00:00Z');
const shipping = { flatCents: 500, freeThresholdCents: 7500 };
const pen: PricingItem = { productId: 1, name: 'Pen', unitPriceCents: 1500, quantity: 2 };
const refill: PricingItem = { productId: 2, name: 'Refill', unitPriceCents: 800, quantity: 1 };
const code = (overrides: Partial<DiscountCodeRule> = {}): DiscountCodeRule => ({
  type: 'PERCENT', value: 10, minOrderCents: 0, usedCount: 0, isActive: true, ...overrides,
});
const promo = (overrides: Partial<PromotionRule> = {}): PromotionRule => ({ productId: 1, type: 'PERCENT', value: 20, isActive: true, ...overrides });

describe('calculateTotals', () => {
  it('adds up list prices and flat shipping with no discounts', () => {
    const t = calculateTotals({ items: [pen, refill], shipping, now });
    expect(t).toMatchObject({ listSubtotalCents: 3800, itemSavingsCents: 0, subtotalCents: 3800, discountCents: 0, shippingCents: 500, totalCents: 4300, codeStatus: 'none' });
  });

  it('subtracts item promotion savings from the total (regression: savings used to be ignored)', () => {
    const t = calculateTotals({ items: [pen, refill], promotions: [promo({ type: 'FIXED_PRICE', value: 1300 })], shipping, now });
    expect(t.itemSavingsCents).toBe(400);
    expect(t.subtotalCents).toBe(3400);
    expect(t.totalCents).toBe(3900);
    expect(t.lines[0]).toMatchObject({ saleUnitPriceCents: 1300, lineTotalCents: 2600, onSale: true });
    expect(t.lines[1].onSale).toBe(false);
  });

  it('stacks a discount code on top of the promoted subtotal', () => {
    const t = calculateTotals({ items: [pen, refill], promotions: [promo()], code: code({ type: 'FIXED', value: 300 }), shipping, now });
    // pen 1500 -> 1200 each; subtotal 2400 + 800 = 3200; code -300; shipping 500
    expect(t.subtotalCents).toBe(3200);
    expect(t.discountCents).toBe(300);
    expect(t.totalCents).toBe(3400);
    expect(t.codeStatus).toBe('applied');
  });

  it('makes shipping free at the threshold, measured after the code discount', () => {
    const big: PricingItem = { productId: 3, name: 'Case', unitPriceCents: 4000, quantity: 2 };
    expect(calculateTotals({ items: [big], shipping, now }).shippingCents).toBe(0);
    const t = calculateTotals({ items: [big], code: code({ type: 'FIXED', value: 600 }), shipping, now });
    expect(t.subtotalCents - t.discountCents).toBe(7400);
    expect(t.shippingCents).toBe(500);
  });

  it('charges shipping when the threshold is zero or missing, and nothing for an empty cart', () => {
    expect(calculateTotals({ items: [pen], shipping: { flatCents: 500, freeThresholdCents: 0 }, now }).shippingCents).toBe(500);
    expect(calculateTotals({ items: [pen], shipping: { flatCents: 500 }, now }).shippingCents).toBe(500);
    expect(calculateTotals({ items: [], shipping, now })).toMatchObject({ shippingCents: 0, totalCents: 0 });
  });

  it('never lets a fixed code push the total below zero', () => {
    const t = calculateTotals({ items: [refill], code: code({ type: 'FIXED', value: 99_999 }), shipping: { flatCents: 0 }, now });
    expect(t.discountCents).toBe(800);
    expect(t.totalCents).toBe(0);
  });

  it('rejects non-integer money and bad quantities', () => {
    expect(() => calculateTotals({ items: [{ ...pen, unitPriceCents: 15.5 }], shipping, now })).toThrow(RangeError);
    expect(() => calculateTotals({ items: [{ ...pen, unitPriceCents: -1 }], shipping, now })).toThrow(RangeError);
    expect(() => calculateTotals({ items: [{ ...pen, quantity: 0 }], shipping, now })).toThrow(RangeError);
    expect(() => calculateTotals({ items: [{ ...pen, quantity: 1.5 }], shipping, now })).toThrow(RangeError);
    expect(() => calculateTotals({ items: [pen], shipping: { flatCents: 4.99 }, now })).toThrow(RangeError);
  });

  it('defaults "now" to the current time', () => {
    expect(calculateTotals({ items: [pen], promotions: [promo()], shipping }).subtotalCents).toBe(2400);
  });
});

describe('promotions', () => {
  it('applies percent promotions with nearest-cent rounding', () => {
    expect(promotionUnitPrice(999, promo({ value: 15 }))).toBe(849); // 149.85 -> 150 off
    expect(promotionUnitPrice(1000, promo({ value: 100 }))).toBe(0);
    expect(promotionUnitPrice(1000, promo({ value: 150 }))).toBe(0);
    expect(promotionUnitPrice(1000, promo({ value: -5 }))).toBe(1000);
  });

  it('never raises the price with a fixed sale price above list', () => {
    expect(promotionUnitPrice(1000, promo({ type: 'FIXED_PRICE', value: 1500 }))).toBe(1000);
    expect(promotionUnitPrice(1000, promo({ type: 'FIXED_PRICE', value: -1 }))).toBe(0);
  });

  it('respects date windows (start inclusive, end exclusive)', () => {
    expect(isWithinWindow(now, new Date('2026-06-15T12:00:00Z'), null)).toBe(true);
    expect(isWithinWindow(now, new Date('2026-06-16T00:00:00Z'), null)).toBe(false);
    expect(isWithinWindow(now, null, new Date('2026-06-15T12:00:00Z'))).toBe(false);
    expect(isWithinWindow(now, undefined, undefined)).toBe(true);
  });

  it('ignores expired, future, inactive and other-product promotions', () => {
    const rules = [
      promo({ endsAt: new Date('2026-06-01') }),
      promo({ startsAt: new Date('2026-07-01') }),
      promo({ isActive: false }),
      promo({ productId: 99 }),
    ];
    expect(bestUnitPrice(pen, rules, now)).toBe(1500);
  });

  it('picks the lowest price when several promotions apply', () => {
    const rules = [promo({ value: 10 }), promo({ type: 'FIXED_PRICE', value: 1100 }), promo({ value: 20 })];
    expect(bestUnitPrice(pen, rules, now)).toBe(1100);
  });
});

describe('discount codes', () => {
  it.each([
    ['inactive', code({ isActive: false })],
    ['expired', code({ expiresAt: new Date('2026-06-15T12:00:00Z') })],
    ['exhausted', code({ maxUses: 5, usedCount: 5 })],
    ['below_minimum', code({ minOrderCents: 5000 })],
  ] as const)('reports %s codes and gives no discount', (status, rule) => {
    expect(evaluateCode(rule, 3000, now)).toEqual({ status, discountCents: 0 });
  });

  it('treats an empty subtotal as below minimum', () => {
    expect(evaluateCode(code(), 0, now).status).toBe('below_minimum');
  });

  it('accepts codes at exactly the minimum and with uses remaining', () => {
    expect(evaluateCode(code({ minOrderCents: 3000, maxUses: 5, usedCount: 4 }), 3000, now)).toEqual({ status: 'applied', discountCents: 300 });
    expect(evaluateCode(code({ expiresAt: new Date('2026-06-16') }), 3000, now).status).toBe('applied');
  });

  it('rounds percent codes to the nearest cent and clamps the percentage', () => {
    expect(evaluateCode(code({ value: 15 }), 999, now).discountCents).toBe(150);
    expect(evaluateCode(code({ value: 250 }), 999, now).discountCents).toBe(999);
    expect(evaluateCode(code({ type: 'FIXED', value: -100 }), 999, now).discountCents).toBe(0);
  });

  it('returns none when there is no code', () => {
    expect(evaluateCode(null, 1000, now)).toEqual({ status: 'none', discountCents: 0 });
  });

  it('normalises codes case-insensitively', () => {
    expect(normalizeCode('  welcome10 ')).toBe('WELCOME10');
  });
});

describe('formatCents', () => {
  it('always shows two decimals (regression: $15.50 used to show as $16)', () => {
    expect(formatCents(1550)).toBe('$15.50');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(123456)).toBe('$1,234.56');
  });
});
