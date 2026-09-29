import { z } from 'zod';

export const quantitySchema = z.coerce.number().int().min(1).max(99);

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: quantitySchema,
});

export const orderSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  address: z.string().min(5).max(240),
  city: z.string().min(2).max(80),
  postcode: z.string().min(3).max(20),
  country: z.string().min(2).max(80),
  discountCode: z.string().optional(),
});
