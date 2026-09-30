import { z } from 'zod';

const trimmed = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, 'This field is required')
    .min(min, `Enter at least ${min} characters`)
    .max(max, `Keep this under ${max} characters`);

export const productIdSchema = z.coerce.number().int().positive();
export const quantitySchema = z.coerce.number().int().min(0).max(99);

export const cartMutationSchema = z.object({
  productId: productIdSchema,
  quantity: quantitySchema,
});

export const discountCodeInputSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Codes use letters, numbers, - and _ only'),
});

export const COUNTRIES = [
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['GB', 'United Kingdom'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['NL', 'Netherlands'],
  ['AU', 'Australia'],
] as const;

const countryCodes = COUNTRIES.map(([code]) => code) as [string, ...string[]];

export const checkoutDetailsSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'This field is required').max(254).email('Enter a valid email address'),
  name: trimmed(2, 120),
  addressLine1: trimmed(3, 160),
  addressLine2: z.string().trim().max(160, 'Keep this under 160 characters').optional().default(''),
  city: trimmed(2, 80),
  region: z.string().trim().max(80, 'Keep this under 80 characters').optional().default(''),
  postcode: trimmed(2, 20).regex(/^[A-Za-z0-9 -]+$/, 'Letters, numbers, spaces and dashes only'),
  country: z.enum(countryCodes, { message: 'Choose a country we ship to' }),
});

export type CheckoutDetails = z.infer<typeof checkoutDetailsSchema>;

export function countryName(code: string): string {
  return COUNTRIES.find(([c]) => c === code)?.[1] ?? code;
}

/** Order status page tokens are 32 random bytes in base64url (43 chars). */
export const publicTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
