export type InvoiceStatus = 'New' | 'Processing' | 'Settled' | 'Expired' | 'Invalid';

export const INVOICE_STATUSES: InvoiceStatus[] = ['New', 'Processing', 'Settled', 'Expired', 'Invalid'];

export type CreateInvoiceInput = {
  orderId: number;
  orderNumber: string;
  amountCents: number;
  redirectUrl: string;
  expirationMinutes: number;
};

export type ProviderInvoice = {
  id: string;
  status: InvoiceStatus;
  /** Internal order ID from invoice metadata. */
  orderId: number | null;
};

export interface PaymentProvider {
  readonly name: 'btcpay' | 'demo';
  createInvoice(input: CreateInvoiceInput): Promise<{ invoiceId: string; checkoutUrl: string }>;
  getInvoice(invoiceId: string): Promise<ProviderInvoice | null>;
  webhookSecret(): string;
}

/** "12.34" from 1234 without floating-point maths. */
export function centsToDecimalString(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError('cents must be a non-negative integer');
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
