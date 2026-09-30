import 'server-only';
import { z } from 'zod';
import { env } from '../env';
import { centsToDecimalString, INVOICE_STATUSES, type PaymentProvider, type ProviderInvoice } from './types';

const invoiceSchema = z.object({
  id: z.string().min(1),
  status: z.enum(INVOICE_STATUSES as [string, ...string[]]),
  checkoutLink: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * BTCPay Server Greenfield API client. The API key only needs the
 * `btcpay.store.cancreateinvoice` and `btcpay.store.canviewinvoices`
 * permissions for this store. Invoices carry the internal order ID only -
 * never names, emails or addresses.
 */
export function btcpayProvider(): PaymentProvider {
  const e = env();
  const base = e.BTCPAY_URL!.replace(/\/$/, '');
  const store = encodeURIComponent(e.BTCPAY_STORE_ID!);

  async function call(path: string, init?: RequestInit) {
    const response = await fetch(`${base}/api/v1/stores/${store}${path}`, {
      ...init,
      headers: { Authorization: `token ${e.BTCPAY_API_KEY}`, 'Content-Type': 'application/json', ...init?.headers },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    return response;
  }

  function toInvoice(data: z.infer<typeof invoiceSchema>): ProviderInvoice {
    const orderId = Number(data.metadata?.orderId);
    return { id: data.id, status: data.status as ProviderInvoice['status'], orderId: Number.isSafeInteger(orderId) ? orderId : null };
  }

  return {
    name: 'btcpay',
    webhookSecret: () => e.BTCPAY_WEBHOOK_SECRET!,
    async createInvoice(input) {
      const response = await call('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          amount: centsToDecimalString(input.amountCents),
          currency: 'USD',
          metadata: { orderId: String(input.orderId), orderNumber: input.orderNumber },
          checkout: {
            redirectURL: input.redirectUrl,
            redirectAutomatically: true,
            expirationMinutes: input.expirationMinutes,
          },
        }),
      });
      if (!response.ok) throw new Error(`BTCPay createInvoice failed with HTTP ${response.status}`);
      const data = invoiceSchema.parse(await response.json());
      if (!data.checkoutLink) throw new Error('BTCPay invoice has no checkout link');
      return { invoiceId: data.id, checkoutUrl: data.checkoutLink };
    },
    async getInvoice(invoiceId) {
      const response = await call(`/invoices/${encodeURIComponent(invoiceId)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`BTCPay getInvoice failed with HTTP ${response.status}`);
      return toInvoice(invoiceSchema.parse(await response.json()));
    },
  };
}
