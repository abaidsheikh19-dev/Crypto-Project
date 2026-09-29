export type OrderStatus = 'pending_payment' | 'payment_detected' | 'paid' | 'processing' | 'shipped' | 'cancelled' | 'refunded';

export type CheckoutOrder = {
  id: string;
  token: string;
  status: OrderStatus;
  totalCents: number;
  email: string;
};

const store: CheckoutOrder[] = [];

export function createOrderRecord(order: CheckoutOrder) {
  store.push(order);
  return order;
}

export function getOrderRecordByToken(token: string) {
  return store.find((order) => order.token === token);
}
