import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/src/components/auth-card';
import { getAdminContext } from '@/src/lib/auth/admin-session';
import { LoginForm } from '../auth-forms';

export const metadata: Metadata = { title: 'Admin sign in' };

export default async function AdminLoginPage() {
  const context = await getAdminContext();
  if (context?.mfaPassed) redirect('/admin');

  return (
    <AuthCard title="Sign in">
      <LoginForm />
      <p className="mt-5 text-sm text-zinc-500">
        Admin accounts are separate from customer accounts and always need two-factor authentication.
      </p>
    </AuthCard>
  );
}
