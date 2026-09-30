import 'server-only';
import { z } from 'zod';
import { db } from './db';

export const settingsSchema = z.object({
  retention_days: z.coerce.number().int().min(7).max(3650),
  inactive_account_days: z.coerce.number().int().min(30).max(3650),
  shipping_flat_cents: z.coerce.number().int().min(0).max(100_000),
  free_shipping_threshold_cents: z.coerce.number().int().min(0).max(10_000_000),
  reservation_minutes: z.coerce.number().int().min(5).max(24 * 60),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  retention_days: 30,
  inactive_account_days: 180,
  shipping_flat_cents: 500,
  free_shipping_threshold_cents: 7500,
  reservation_minutes: 30,
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(DEFAULT_SETTINGS) } } });
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) merged[row.key] = row.value;
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function getMeta(key: string): Promise<string | null> {
  return (await db.setting.findUnique({ where: { key } }))?.value ?? null;
}

export async function setMeta(key: string, value: string, updatedBy?: number) {
  await db.setting.upsert({ where: { key }, create: { key, value, updatedBy }, update: { value, updatedBy } });
}
