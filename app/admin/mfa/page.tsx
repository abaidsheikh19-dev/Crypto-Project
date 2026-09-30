import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/src/components/auth-card';
import { getAdminContext } from '@/src/lib/auth/admin-session';
import { MfaForm } from '../auth-forms';

export const metadata: Metadata = { title: 'Two-factor authentication' };

export default async function MfaPage() {
  const context = await getAdminContext();
  if (!context) redirect('/admin/login');
  if (context.mfaPassed) redirect('/admin');
  if (!context.admin.totpEnabledAt) redirect('/admin/mfa/setup');

  return (
    <AuthCard title="Two-factor authentication">
      <p className="mt-2 text-sm text-zinc-400">Open your authenticator app and enter the current code for this store.</p>
      <MfaForm />
    </AuthCard>
  );
}
