import Link from 'next/link';
import { getCartView } from '@/src/lib/cart';
import { env } from '@/src/lib/env';
import { STORE_NAME } from '@/src/lib/brand';

const POLICIES = [
  ['terms', 'Terms of Sale'],
  ['shipping', 'Shipping'],
  ['refund', 'Refunds'],
  ['privacy', 'Privacy'],
] as const;

export async function StoreShell({ children }: { children: React.ReactNode }) {
  const cart = await getCartView();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-emerald-500 focus:px-3 focus:py-2 focus:text-ink-950">
        Skip to content
      </a>
      <header className="border-b border-emerald-500/15 bg-ink-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-black text-ink-950">₿</span>
            <span className="text-lg font-bold tracking-tight text-white">{STORE_NAME}</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2 text-sm">
            <Link href="/" className="rounded-full px-3 py-1.5 text-zinc-300 hover:text-white">Shop</Link>
            <Link href="/cart" className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-200 hover:border-emerald-400">
              Cart{cart.itemCount > 0 ? ` (${cart.itemCount})` : ''}
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-10">
        {children}
      </main>
      <footer className="border-t border-emerald-500/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-zinc-400 md:flex-row md:items-center md:justify-between md:px-6">
          <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">
            {POLICIES.map(([slug, label]) => (
              <Link key={slug} href={`/policies/${slug}`} className="hover:text-emerald-200">{label}</Link>
            ))}
          </nav>
          <a href={`mailto:${env().CONTACT_EMAIL}`} className="hover:text-emerald-200">{env().CONTACT_EMAIL}</a>
        </div>
      </footer>
    </div>
  );
}
