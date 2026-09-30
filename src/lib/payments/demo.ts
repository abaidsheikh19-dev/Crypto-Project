import 'server-only';
import { db } from '../db';
import { mockWebhookSecret, randomToken } from '../crypto';
import type { InvoiceStatus, PaymentProvider, ProviderInvoice } from './types';

/**
 * Demo payment provider: stands in for BTCPay while no BTCPay Server is
 * connected. Invoices live in the `mock_invoices` table and are paid with the
 * simulator at /pay/demo/<id>, which sends a signed webhook through the same
 * verification path real BTCPay webhooks use.
 */
export function demoProvider(): PaymentProvider {
  return {
    name: 'demo',
    webhookSecret: mockWebhookSecret,
    async createInvoice(input) {
      const id = `demo_${randomToken(12)}`;
      await db.mockInvoice.create({
        data: {
          id,
          orderId: input.orderId,
          amountCents: input.amountCents,
          redirectUrl: input.redirectUrl,
          expiresAt: new Date(Date.now() + input.expirationMinutes * 60_000),
        },
      });
      return { invoiceId: id, checkoutUrl: `/pay/demo/${id}` };
    },
    async getInvoice(invoiceId): Promise<ProviderInvoice | null> {
      const invoice = await db.mockInvoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) return null;
      let status = invoice.status as InvoiceStatus;
      if (status === 'New' && invoice.expiresAt <= new Date()) status = 'Expired';
      return { id: invoice.id, status, orderId: invoice.orderId };
    },
  };
}
