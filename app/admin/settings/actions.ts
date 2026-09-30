'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { audit } from '@/src/lib/audit';
import { getSettings, settingsSchema, type SettingKey } from '@/src/lib/settings';
import { parseDollarsToCents } from '@/src/lib/money';
import { clientIpHash } from '@/src/lib/request';
import { runPurge } from '@/src/server/purge';

export async function saveSettings(formData: FormData) {
  const { admin } = await requireAdmin({ role: 'OWNER' });
  const parsed = settingsSchema.safeParse({
    retention_days: formData.get('retention_days'),
    inactive_account_days: formData.get('inactive_account_days'),
    shipping_flat_cents: parseDollarsToCents(String(formData.get('shipping_flat') ?? '')) ?? -1,
    free_shipping_threshold_cents: parseDollarsToCents(String(formData.get('free_shipping_threshold') || '0')) ?? -1,
    reservation_minutes: formData.get('reservation_minutes'),
  });
  if (!parsed.success) redirect('/admin/settings?msg=invalid');

  const before = await getSettings();
  const changed = (Object.keys(parsed.data) as SettingKey[]).filter((key) => before[key] !== parsed.data[key]);
  await db.$transaction(
    changed.map((key) =>
      db.setting.upsert({
        where: { key },
        create: { key, value: String(parsed.data[key]), updatedBy: admin.id },
        update: { value: String(parsed.data[key]), updatedBy: admin.id },
      }),
    ),
  );
  if (changed.length) {
    await audit(
      { type: 'admin', id: admin.id },
      changed.some((key) => key.endsWith('_days')) ? 'settings.retention_changed' : 'settings.changed',
      { type: 'settings', id: 'store' },
      Object.fromEntries(changed.map((key) => [key, { from: before[key], to: parsed.data[key] }])),
      { ipHash: await clientIpHash() },
    );
  }
  redirect('/admin/settings?msg=saved');
}

export async function runPurgeNow() {
  const { admin } = await requireAdmin({ role: 'OWNER' });
  await runPurge({ type: 'admin', id: admin.id });
  redirect('/admin/settings?msg=purged');
}
