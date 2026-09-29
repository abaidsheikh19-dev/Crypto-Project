import { notFound } from 'next/navigation';
import { getOrderRecordByToken } from '@/src/lib/orders';

export default function OrderStatusPage({ params }: { params: { token: string } }) {
  const order = getOrderRecordByToken(params.token);

  if (!order) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl rounded-xl border border-emerald-500/20 bg-ink-900 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Order status</p>
        <h1 className="mt-3 text-3xl font-bold text-white">#{order.id}</h1>
        <p className="mt-3 text-zinc-300">Status: <span className="font-semibold text-emerald-300">{order.status}</span></p>
        <p className="mt-4 text-zinc-300">Confirmation email: {order.email}</p>
        <p className="mt-3 text-sm text-zinc-400">This token is randomly generated and not guessable in the production version.</p>
      </div>
    </main>
  );
}
