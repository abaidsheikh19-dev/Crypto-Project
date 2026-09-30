import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/src/components/auth-card';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { decrypt } from '@/src/lib/crypto';

export const metadata: Metadata = { title: 'Recovery codes' };

export default async function RecoveryCodesPage() {
  const { admin } = await requireAdmin();
  // Claim and delete the one-time copy atomically, so the codes can only ever be shown once.
  const row = await db.adminUser.findUnique({ where: { id: admin.id }, select: { pendingRecoveryEnc: true } });
  if (!row?.pendingRecoveryEnc) redirect('/admin');
  const claimed = await db.adminUser.updateMany({ where: { id: admin.id, pendingRecoveryEnc: row.pendingRecoveryEnc }, data: { pendingRecoveryEnc: null } });
  if (claimed.count !== 1) redirect('/admin');
  const codes = JSON.parse(decrypt(row.pendingRecoveryEnc)) as string[];

  return (
    <AuthCard title="Save your recovery codes">
      <p className="notice-info mt-4">Two-factor authentication is on.</p>
      <p className="mt-4 text-sm text-zinc-400">
        Each code works once if you lose your phone. They will not be shown again - store them offline, for example in a password manager.
      </p>
      <ul data-testid="recovery-codes" className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-emerald-500/20 bg-black/30 p-4 font-mono text-sm text-emerald-100">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>
      <Link href="/admin" className="btn-primary mt-6 w-full py-3">I&apos;ve saved them - continue</Link>
    </AuthCard>
  );
}
