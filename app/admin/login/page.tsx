import Link from 'next/link';

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6 py-10 text-zinc-100">
      <div className="w-full max-w-md rounded-xl border border-emerald-500/20 bg-ink-900 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Admin</p>
        <h1 className="mt-3 text-3xl font-bold text-white">Login</h1>
        <form action="/admin" className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">Email</label>
            <input name="email" type="email" defaultValue="owner@demo.local" className="w-full rounded-md border border-emerald-500/30 bg-transparent px-3 py-2 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm text-zinc-300">Password</label>
            <input name="password" type="password" defaultValue="admin123" className="w-full rounded-md border border-emerald-500/30 bg-transparent px-3 py-2 text-white" />
          </div>
          <button type="submit" className="w-full rounded-md bg-emerald-500 px-4 py-3 font-semibold text-ink-950">
            Continue
          </button>
        </form>
        <div className="mt-5 text-sm text-zinc-400">
          Demo-only prototype. Production login includes MFA, rate limiting, and separate admin sessions.
        </div>
        <div className="mt-4">
          <Link href="/catalog" className="text-sm text-emerald-300">← Return to storefront</Link>
        </div>
      </div>
    </main>
  );
}
