import Link from 'next/link';
import { AuthCard } from '@/src/components/auth-card';

export default function ForbiddenPage() {
  return (
    <AuthCard title="Owner access only">
      <p className="mt-3 text-zinc-300">That area is limited to the store owner. Ask the owner if you need access.</p>
      <Link href="/admin" className="btn-secondary mt-6">Back to dashboard</Link>
    </AuthCard>
  );
}
