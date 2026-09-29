import Link from 'next/link';

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-ink-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Admin</p>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          </div>
          <Link href="/catalog" className="text-sm text-emerald-300">Storefront</Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/20 bg-ink-900 p-5">
            <p className="text-sm text-zinc-400">Orders awaiting shipment</p>
            <p className="mt-2 text-3xl font-bold text-white">12</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-ink-900 p-5">
            <p className="text-sm text-zinc-400">Low stock alerts</p>
            <p className="mt-2 text-3xl font-bold text-white">3</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-ink-900 p-5">
            <p className="text-sm text-zinc-400">Recent orders</p>
            <p className="mt-2 text-3xl font-bold text-white">28</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-emerald-500/20 bg-ink-900 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">Prototype admin controls</h2>
          <ul className="space-y-2 text-zinc-300">
            <li>• Products: create, edit, archive, stock management</li>
            <li>• Promotions: discount codes and sales windows</li>
            <li>• Orders: status updates, shipment tracking, refund logs</li>
            <li>• Retention and exports: owner-only settings and encrypted downloads</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
