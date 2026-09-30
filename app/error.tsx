'use client';

import Link from 'next/link';

// Generic error page: never shows stack traces or error details to visitors.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card-pad max-w-md text-center">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-bold text-white">We couldn&apos;t load this page</h1>
        <p className="mt-2 text-zinc-400">Please try again. If it keeps happening, contact us{error.digest ? ` and mention reference ${error.digest}` : ''}.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-ghost">Back to shop</Link>
        </div>
      </div>
    </main>
  );
}
