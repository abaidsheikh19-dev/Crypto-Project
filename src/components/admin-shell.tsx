import Link from 'next/link';
import type { AdminContext } from '@/src/lib/auth/admin-session';
import { paymentsMode } from '@/src/lib/env';
import { STORE_NAME } from '@/src/lib/brand';
import { logoutAction } from '@/app/admin/auth-actions';

const NAV: { href: string; label: string; ownerOnly?: boolean }[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/promotions', label: 'Promotions' },
  { href: '/admin/emails', label: 'Emails', ownerOnly: true },
  { href: '/admin/settings', label: 'Settings', ownerOnly: true },
  { href: '/admin/export', label: 'Export', ownerOnly: true },
  { href: '/admin/users', label: 'Admin users', ownerOnly: true },
  { href: '/admin/audit', label: 'Audit log', ownerOnly: true },
];

export function AdminShell({ context, title, actions, children }: { context: AdminContext; title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const isOwner = context.admin.role === 'OWNER';
  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <aside className="border-b border-emerald-500/15 bg-ink-950/80 md:min-h-screen md:border-b-0 md:border-r">
        <div className="px-4 py-5">
          <Link href="/admin" className="font-bold text-white">{STORE_NAME}</Link>
          <p className="mt-1 text-xs text-zinc-500">{context.admin.email} · {isOwner ? 'Owner' : 'Staff'}</p>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:pb-0">
          {NAV.filter((item) => isOwner || !item.ownerOnly).map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-emerald-500/10 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden space-y-2 px-4 py-5 md:block">
          <Link href="/" className="block text-sm text-zinc-400 hover:text-white">View storefront ↗</Link>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-zinc-400 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        {paymentsMode() === 'demo' ? (
          <p className="border-b border-amber-400/20 bg-amber-400/10 px-6 py-2 text-xs text-amber-100">
            Demo payment mode - invoices are simulated. Connect BTCPay Server to take real payments.
          </p>
        ) : null}
        <div className="px-4 py-6 md:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <div className="flex items-center gap-2">
              {actions}
              <form action={logoutAction} className="md:hidden">
                <button type="submit" className="btn-ghost">Sign out</button>
              </form>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'cancelled' || status === 'refunded'
      ? 'border-red-500/40 bg-red-500/10 text-red-200'
      : status === 'shipped'
        ? 'border-sky-400/40 bg-sky-400/10 text-sky-200'
        : status === 'paid' || status === 'processing'
          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
          : 'border-amber-400/40 bg-amber-400/10 text-amber-100';
  return <span className={`pill ${tone}`}>{status.replace('_', ' ')}</span>;
}

export function Flash({ message, tone = 'info' }: { message?: string | null; tone?: 'info' | 'warn' | 'error' }) {
  return message ? <p role="status" className={`notice-${tone} mb-6`}>{message}</p> : null;
}
