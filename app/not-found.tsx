import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card-pad max-w-md text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-3 text-2xl font-bold text-white">Page not found</h1>
        <p className="mt-2 text-zinc-400">The page you were looking for does not exist or has moved.</p>
        <Link href="/" className="btn-primary mt-6">Back to shop</Link>
      </div>
    </main>
  );
}
