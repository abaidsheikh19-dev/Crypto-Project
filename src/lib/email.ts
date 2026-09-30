import 'server-only';
import { db, type Tx } from './db';
import { decrypt, encrypt } from './crypto';
import { env } from './env';
import { errorName, log } from './log';
import { formatCents } from './pricing';

/**
 * Transactional email. Messages are written to an encrypted outbox first and
 * sent from there with retries, so a provider outage never loses an email.
 * With no RESEND_API_KEY configured (demo mode) messages are marked CAPTURED
 * and can be read in Admin -> Emails instead of being sent.
 *
 * Templates are plain text first, with minimal HTML: no images, no tracking
 * pixels, no tracked links.
 */

export type EmailMessage = { template: string; to: string; subject: string; text: string; html: string };

const MAX_ATTEMPTS = 5;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function wrapHtml(paragraphs: string[]): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join('');
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${body}</body></html>`;
}

type Line = { name: string; qty: number; unitPriceCents: number };

export function paymentConfirmedEmail(input: { to: string; orderNumber: string; items: Line[]; totalCents: number; statusUrl: string }): EmailMessage {
  const itemLines = input.items.map((i) => `${i.qty} x ${i.name} - ${formatCents(i.unitPriceCents * i.qty)}`);
  const text = [
    `Thanks - your payment for order ${input.orderNumber} is confirmed.`,
    '',
    ...itemLines,
    '',
    `Total paid: ${formatCents(input.totalCents)}`,
    '',
    `Order status: ${input.statusUrl}`,
    '',
    'We will email you again when your order ships.',
  ].join('\n');
  const html = wrapHtml([
    `Thanks - your payment for order <strong>${escapeHtml(input.orderNumber)}</strong> is confirmed.`,
    itemLines.map(escapeHtml).join('<br>'),
    `Total paid: <strong>${escapeHtml(formatCents(input.totalCents))}</strong>`,
    `Order status: <a href="${escapeHtml(input.statusUrl)}">${escapeHtml(input.statusUrl)}</a>`,
    'We will email you again when your order ships.',
  ]);
  return { template: 'payment_confirmed', to: input.to, subject: `Payment confirmed - order ${input.orderNumber}`, text, html };
}

export function orderShippedEmail(input: { to: string; orderNumber: string; trackingNumber: string | null; statusUrl: string | null }): EmailMessage {
  const tracking = input.trackingNumber ? `Tracking number: ${input.trackingNumber}` : 'No tracking number was provided for this shipment.';
  const text = [
    `Good news - order ${input.orderNumber} has shipped.`,
    '',
    tracking,
    ...(input.statusUrl ? ['', `Order status: ${input.statusUrl}`] : []),
  ].join('\n');
  const html = wrapHtml([
    `Good news - order <strong>${escapeHtml(input.orderNumber)}</strong> has shipped.`,
    escapeHtml(tracking),
    ...(input.statusUrl ? [`Order status: <a href="${escapeHtml(input.statusUrl)}">${escapeHtml(input.statusUrl)}</a>`] : []),
  ]);
  return { template: 'order_shipped', to: input.to, subject: `Order ${input.orderNumber} has shipped`, text, html };
}

export async function enqueueEmail(message: EmailMessage, options: { orderId?: number; tx?: Tx } = {}) {
  await (options.tx ?? db).emailOutbox.create({
    data: {
      template: message.template,
      toEnc: encrypt(message.to),
      subjectEnc: encrypt(message.subject),
      bodyTextEnc: encrypt(message.text),
      bodyHtmlEnc: encrypt(message.html),
      orderId: options.orderId ?? null,
    },
  });
}

async function sendWithResend(message: EmailMessage, apiKey: string, from: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`);
}

/** Deliver queued emails. Safe to call often; each message is claimed before sending. */
export async function processOutbox(limit = 20): Promise<{ sent: number; captured: number; failed: number }> {
  const e = env();
  const result = { sent: 0, captured: 0, failed: 0 };
  const queued = await db.emailOutbox.findMany({
    where: { status: 'QUEUED', attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { id: 'asc' },
    take: limit,
  });

  for (const row of queued) {
    // Claim the row so concurrent workers do not send it twice.
    const claimed = await db.emailOutbox.updateMany({
      where: { id: row.id, status: 'QUEUED', attempts: row.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;

    if (!e.RESEND_API_KEY || !e.EMAIL_FROM) {
      await db.emailOutbox.update({ where: { id: row.id }, data: { status: 'CAPTURED', sentAt: new Date() } });
      result.captured++;
      continue;
    }

    try {
      await sendWithResend(
        {
          template: row.template,
          to: decrypt(row.toEnc),
          subject: decrypt(row.subjectEnc),
          text: decrypt(row.bodyTextEnc),
          html: decrypt(row.bodyHtmlEnc),
        },
        e.RESEND_API_KEY,
        e.EMAIL_FROM,
      );
      await db.emailOutbox.update({ where: { id: row.id }, data: { status: 'SENT', sentAt: new Date(), lastError: null } });
      result.sent++;
    } catch (error) {
      const attempts = row.attempts + 1;
      await db.emailOutbox.update({
        where: { id: row.id },
        data: { status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'QUEUED', lastError: errorName(error) },
      });
      // Log the outbox ID and template only - never the recipient.
      log('warn', 'email.send_failed', { outboxId: row.id, template: row.template, attempts });
      result.failed++;
    }
  }
  return result;
}
