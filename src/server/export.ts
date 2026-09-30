import 'server-only';
import { Encrypter } from 'age-encryption';
import { db } from '@/src/lib/db';
import { decryptOptional } from '@/src/lib/crypto';

export type ExportFormat = 'csv' | 'json';

const COLUMNS = [
  'order_number', 'created_at', 'status', 'email', 'name', 'address_line1', 'address_line2', 'city', 'region', 'postcode', 'country',
  'items', 'subtotal_cents', 'discount_cents', 'shipping_cents', 'total_cents', 'tracking_number', 'paid_at', 'shipped_at', 'pii_purged_at',
] as const;

type Row = Record<(typeof COLUMNS)[number], string | number | null>;

export async function loadExportRows(from: Date, to: Date): Promise<Row[]> {
  const orders = await db.order.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: 'asc' },
    include: { items: true },
    take: 10_000,
  });
  return orders.map((order) => ({
    order_number: order.orderNumber,
    created_at: order.createdAt.toISOString(),
    status: order.status,
    email: decryptOptional(order.emailEnc),
    name: decryptOptional(order.nameEnc),
    address_line1: decryptOptional(order.addressLine1Enc),
    address_line2: decryptOptional(order.addressLine2Enc),
    city: decryptOptional(order.cityEnc),
    region: decryptOptional(order.regionEnc),
    postcode: decryptOptional(order.postcodeEnc),
    country: decryptOptional(order.countryEnc),
    items: order.items.map((item) => `${item.qty} x ${item.productNameSnapshot}`).join('; '),
    subtotal_cents: order.subtotalCents,
    discount_cents: order.discountCents,
    shipping_cents: order.shippingCents,
    total_cents: order.totalCents,
    tracking_number: order.trackingNumber,
    paid_at: order.paidAt?.toISOString() ?? null,
    shipped_at: order.shippedAt?.toISOString() ?? null,
    pii_purged_at: order.piiPurgedAt?.toISOString() ?? null,
  }));
}

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let text = String(value);
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell).
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Row[]): string {
  return [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(','))].join('\r\n') + '\r\n';
}

export function toJson(rows: Row[]): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), orders: rows }, null, 2);
}

/** Encrypts in memory. The plaintext is never written anywhere. */
export async function encryptExport(plaintext: string, key: { passphrase: string } | { recipient: string }): Promise<Uint8Array> {
  const encrypter = new Encrypter();
  if ('passphrase' in key) encrypter.setPassphrase(key.passphrase);
  else encrypter.addRecipient(key.recipient);
  return encrypter.encrypt(plaintext);
}
