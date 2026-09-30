import { z } from 'zod';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { audit } from '@/src/lib/audit';
import { clientIpHash } from '@/src/lib/request';
import { encryptExport, loadExportRows, toCsv, toJson } from '@/src/server/export';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    format: z.enum(['csv', 'json']),
    method: z.enum(['passphrase', 'recipient']),
    passphrase: z.string().max(200).optional(),
    confirm: z.string().max(200).optional(),
    recipient: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.method === 'passphrase') {
      if (!value.passphrase || value.passphrase.length < 12) ctx.addIssue({ code: 'custom', message: 'passphrase', path: ['passphrase'] });
      else if (value.passphrase !== value.confirm) ctx.addIssue({ code: 'custom', message: 'confirm', path: ['confirm'] });
    } else if (!value.recipient || !/^age1[0-9a-z]{20,}$/.test(value.recipient)) {
      ctx.addIssue({ code: 'custom', message: 'recipient', path: ['recipient'] });
    }
  });

function back(request: Request, error: string) {
  return Response.redirect(new URL(`/admin/export?error=${error}`, request.url), 303);
}

/**
 * Route handlers do not get the server-action Origin check, so verify it here.
 */
function sameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return false;
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response('Forbidden', { status: 403 });
  const { admin } = await requireAdmin({ role: 'OWNER' });

  const form = await request.formData();
  const parsed = schema.safeParse(Object.fromEntries(['from', 'to', 'format', 'method', 'passphrase', 'confirm', 'recipient'].map((k) => [k, form.get(k) ?? undefined])));
  if (!parsed.success) return back(request, String(parsed.error.issues[0]?.message ?? 'invalid'));
  const { from, to, format, method } = parsed.data;
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000);
  if (end <= start) return back(request, 'range');

  const rows = await loadExportRows(start, end);
  const plaintext = format === 'csv' ? toCsv(rows) : toJson(rows);
  const encrypted = await encryptExport(plaintext, method === 'passphrase' ? { passphrase: parsed.data.passphrase! } : { recipient: parsed.data.recipient! });

  await audit({ type: 'admin', id: admin.id }, 'export.downloaded', { type: 'export', id: `${from}_${to}` }, { orders: rows.length, format, method }, { ipHash: await clientIpHash() });

  return new Response(Buffer.from(encrypted), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="orders_${from}_${to}.${format}.age"`,
      'Cache-Control': 'no-store',
    },
  });
}
