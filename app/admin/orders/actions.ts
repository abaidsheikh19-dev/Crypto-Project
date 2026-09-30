'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { OrderStatus } from '@prisma/client';
import { db } from '@/src/lib/db';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { audit } from '@/src/lib/audit';
import { decrypt, decryptOptional } from '@/src/lib/crypto';
import { enqueueEmail, orderShippedEmail, processOutbox } from '@/src/lib/email';
import { applyInvoiceStatus, statusUrl } from '@/src/lib/orders';
import { clientIpHash } from '@/src/lib/request';

const idSchema = z.coerce.number().int().positive();

async function transition(orderId: number, from: OrderStatus[], to: OrderStatus, extra: Record<string, unknown> = {}) {
  const moved = await db.order.updateMany({ where: { id: orderId, status: { in: from } }, data: { status: to, ...extra } });
  return moved.count === 1;
}

export async function updateOrderStatus(formData: FormData) {
  const { admin } = await requireAdmin();
  const parsed = z
    .object({
      orderId: idSchema,
      action: z.enum(['processing', 'shipped', 'refunded', 'cancel', 'clear_review']),
      trackingNumber: z.string().trim().max(80).regex(/^[A-Za-z0-9 -]*$/).optional().default(''),
    })
    .safeParse({ orderId: formData.get('orderId'), action: formData.get('action'), trackingNumber: formData.get('trackingNumber') ?? '' });
  if (!parsed.success) redirect('/admin/orders?msg=invalid');
  const { orderId, action, trackingNumber } = parsed.data;
  const before = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!before) redirect('/admin/orders?msg=invalid');
  const ipHash = await clientIpHash();
  let ok = false;

  if (action === 'processing') {
    ok = await transition(orderId, ['paid'], 'processing');
  } else if (action === 'shipped') {
    const now = new Date();
    ok = await transition(orderId, ['paid', 'processing'], 'shipped', { shippedAt: now, closedAt: now, trackingNumber: trackingNumber || null });
    if (ok) {
      const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
      if (order.emailEnc) {
        const token = decryptOptional(order.publicTokenEnc);
        await enqueueEmail(
          orderShippedEmail({ to: decrypt(order.emailEnc), orderNumber: order.orderNumber, trackingNumber: order.trackingNumber, statusUrl: token ? statusUrl(token) : null }),
          { orderId },
        );
        await processOutbox();
      }
    }
  } else if (action === 'refunded') {
    ok = await transition(orderId, ['paid', 'processing', 'shipped'], 'refunded', { closedAt: new Date() });
  } else if (action === 'cancel') {
    ok = (await applyInvoiceStatus(orderId, 'Invalid', `admin:${admin.id}`)) === 'cancelled' && before.status !== 'cancelled';
  } else if (action === 'clear_review') {
    ok = (await db.order.updateMany({ where: { id: orderId, needsReview: true }, data: { needsReview: false } })).count === 1;
  }

  if (ok) {
    await audit({ type: 'admin', id: admin.id }, action === 'clear_review' ? 'order.review_cleared' : 'order.status_changed', { type: 'order', id: orderId }, { from: before.status, action, hasTracking: Boolean(trackingNumber) }, { ipHash });
  }
  redirect(`/admin/orders/${orderId}?msg=${ok ? 'updated' : 'not_allowed'}`);
}
