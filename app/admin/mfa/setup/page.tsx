import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { AuthCard } from '@/src/components/auth-card';
import { getAdminContext } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { decrypt, encrypt } from '@/src/lib/crypto';
import { generateTotpSecret, otpauthUri } from '@/src/lib/auth/totp';
import { STORE_NAME } from '@/src/lib/brand';
import { EnrolForm } from '../../auth-forms';

export const metadata: Metadata = { title: 'Set up two-factor authentication' };

export default async function MfaSetupPage() {
  const context = await getAdminContext();
  if (!context) redirect('/admin/login');
  if (context.admin.totpEnabledAt) redirect(context.mfaPassed ? '/admin' : '/admin/mfa');

  // The pending secret is stored encrypted until the first code confirms it.
  const admin = await db.adminUser.findUniqueOrThrow({ where: { id: context.admin.id } });
  let secret = admin.totpSecretEnc ? decrypt(admin.totpSecretEnc) : null;
  if (!secret) {
    secret = generateTotpSecret();
    await db.adminUser.update({ where: { id: admin.id }, data: { totpSecretEnc: encrypt(secret) } });
  }
  const svg = await QRCode.toString(otpauthUri(secret, admin.email, STORE_NAME), { type: 'svg', margin: 1 });
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  return (
    <AuthCard title="Set up two-factor authentication">
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-300">
        <li>Install an authenticator app (Google Authenticator, 1Password, Authy, Aegis…).</li>
        <li>Scan this QR code, or type the key below.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="mt-5 flex justify-center rounded-2xl bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc} alt="QR code for your authenticator app" className="h-44 w-44" />
      </div>
      <p className="mt-3 text-center text-xs text-zinc-400">Setup key</p>
      <p data-testid="totp-secret" className="mt-1 break-all text-center font-mono text-sm text-emerald-200">{secret}</p>
      <EnrolForm />
    </AuthCard>
  );
}
