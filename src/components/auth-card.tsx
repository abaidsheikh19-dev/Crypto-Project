import { STORE_NAME } from '@/src/lib/brand';

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card-pad w-full max-w-md">
        <p className="eyebrow">{STORE_NAME} admin</p>
        <h1 className="mt-3 text-2xl font-bold text-white">{title}</h1>
        {children}
      </div>
    </main>
  );
}
