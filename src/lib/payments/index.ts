import 'server-only';
import { paymentsMode } from '../env';
import { btcpayProvider } from './btcpay';
import { demoProvider } from './demo';
import type { PaymentProvider } from './types';

export function activeProvider(): PaymentProvider {
  return paymentsMode() === 'btcpay' ? btcpayProvider() : demoProvider();
}

export function providerByName(name: string): PaymentProvider {
  return name === 'btcpay' ? btcpayProvider() : demoProvider();
}
