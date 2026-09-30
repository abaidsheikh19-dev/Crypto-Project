'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/src/lib/db';
import { decrypt, encrypt, hashToken } from '@/src/lib/crypto';
import { audit } from '@/src/lib/audit';
import { verifyPassword } from '@/src/lib/auth/password';
import { generateRecoveryCodes, normalizeRecoveryCode, verifyTotp } from '@/src/lib/auth/totp';
import { endAdminSession, getAdminContext, startAdminSession } from '@/src/lib/auth/admin-session';
import { consumeRateLimit } from '@/src/lib/rate-limit';
import { clientIpHash } from '@/src/lib/request';

export type AuthFormState = { error?: string };

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const GENERIC_LOGIN_ERROR = 'Email or password is incorrect, or the account is temporarily locked.';

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(200) });
const codeSchema = z.object({ code: z.string().trim().min(6).max(20) });

async function recordFailure(adminId: number, failedLoginCount: number) {
  const failures = failedLoginCount + 1;
  await db.adminUser.update({
    where: { id: adminId },
    data: failures >= MAX_FAILURES ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLoginCount: failures },
  });
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const ipHash = await clientIpHash();
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: GENERIC_LOGIN_ERROR };

  const withinIpLimit = await consumeRateLimit('adminLogin', `ip:${ipHash}`);
  const withinAccountLimit = await consumeRateLimit('adminLogin', `email:${parsed.data.email}`);
  if (!withinIpLimit || !withinAccountLimit) return { error: 'Too many sign-in attempts. Please wait 15 minutes.' };

  const admin = await db.adminUser.findUnique({ where: { email: parsed.data.email } });
  const locked = Boolean(admin?.lockedUntil && admin.lockedUntil > new Date());
  // Always run a full Argon2 verification so timing does not reveal whether the account exists.
  const passwordOk = await verifyPassword(admin?.isActive ? admin.passwordHash : null, parsed.data.password);

  if (!admin || !admin.isActive || locked || !passwordOk) {
    if (admin && admin.isActive && !locked) await recordFailure(admin.id, admin.failedLoginCount);
    await audit({ type: 'anonymous' }, 'admin.login_failed', admin ? { type: 'admin', id: admin.id } : null, { reason: locked ? 'locked' : 'bad_credentials' }, { ipHash });
    return { error: GENERIC_LOGIN_ERROR };
  }

  await db.adminUser.update({ where: { id: admin.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await startAdminSession(admin.id, false);
  await audit({ type: 'admin', id: admin.id }, 'admin.login_password_ok', { type: 'admin', id: admin.id }, undefined, { ipHash });
  redirect(admin.totpEnabledAt ? '/admin/mfa' : '/admin/mfa/setup');
}

export async function verifyMfaAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const context = await getAdminContext();
  if (!context) redirect('/admin/login');
  if (context.mfaPassed) redirect('/admin');
  if (!context.admin.totpEnabledAt) redirect('/admin/mfa/setup');

  const ipHash = await clientIpHash();
  if (!(await consumeRateLimit('adminMfa', `${context.admin.id}:${ipHash}`))) {
    return { error: 'Too many attempts. Please wait 15 minutes.' };
  }
  const parsed = codeSchema.safeParse({ code: formData.get('code') });
  const admin = await db.adminUser.findUniqueOrThrow({ where: { id: context.admin.id } });
  let method: 'totp' | 'recovery_code' | null = null;

  if (parsed.success && /^\d{6}$/.test(parsed.data.code) && admin.totpSecretEnc) {
    const counter = verifyTotp(decrypt(admin.totpSecretEnc), parsed.data.code, { lastCounter: admin.totpLastCounter });
    if (counter !== null) {
      // Conditional update: a code can only ever be used once, even under a race.
      const used = await db.adminUser.updateMany({
        where: { id: admin.id, OR: [{ totpLastCounter: null }, { totpLastCounter: { lt: counter } }] },
        data: { totpLastCounter: counter },
      });
      if (used.count === 1) method = 'totp';
    }
  } else if (parsed.success) {
    const codeHash = hashToken(normalizeRecoveryCode(parsed.data.code));
    if (admin.recoveryCodeHashes.includes(codeHash)) {
      await db.adminUser.update({ where: { id: admin.id }, data: { recoveryCodeHashes: admin.recoveryCodeHashes.filter((h) => h !== codeHash) } });
      method = 'recovery_code';
    }
  }

  if (!method) {
    await recordFailure(admin.id, admin.failedLoginCount);
    await audit({ type: 'admin', id: admin.id }, 'admin.mfa_failed', { type: 'admin', id: admin.id }, undefined, { ipHash });
    if (admin.failedLoginCount + 1 >= MAX_FAILURES) {
      await endAdminSession();
      redirect('/admin/login');
    }
    return { error: 'That code is not valid. Check your authenticator app and try again.' };
  }

  await db.adminUser.update({ where: { id: admin.id }, data: { failedLoginCount: 0, lastLoginAt: new Date() } });
  await startAdminSession(admin.id, true);
  await audit({ type: 'admin', id: admin.id }, 'admin.login_success', { type: 'admin', id: admin.id }, { method }, { ipHash });
  redirect('/admin');
}

export async function enrollMfaAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const context = await getAdminContext();
  if (!context) redirect('/admin/login');
  if (context.admin.totpEnabledAt) redirect(context.mfaPassed ? '/admin' : '/admin/mfa');

  const ipHash = await clientIpHash();
  if (!(await consumeRateLimit('adminMfa', `${context.admin.id}:${ipHash}`))) {
    return { error: 'Too many attempts. Please wait 15 minutes.' };
  }
  const admin = await db.adminUser.findUniqueOrThrow({ where: { id: context.admin.id } });
  const parsed = codeSchema.safeParse({ code: formData.get('code') });
  const counter = parsed.success && admin.totpSecretEnc ? verifyTotp(decrypt(admin.totpSecretEnc), parsed.data.code) : null;
  if (counter === null) {
    await audit({ type: 'admin', id: admin.id }, 'admin.mfa_enrol_failed', { type: 'admin', id: admin.id }, undefined, { ipHash });
    return { error: 'That code did not match. Make sure your phone’s clock is correct and try the newest code.' };
  }

  const recoveryCodes = generateRecoveryCodes();
  await db.adminUser.update({
    where: { id: admin.id },
    data: {
      totpEnabledAt: new Date(),
      totpLastCounter: counter,
      recoveryCodeHashes: recoveryCodes.map((code) => hashToken(normalizeRecoveryCode(code))),
      pendingRecoveryEnc: encrypt(JSON.stringify(recoveryCodes)),
      lastLoginAt: new Date(),
    },
  });
  await startAdminSession(admin.id, true);
  await audit({ type: 'admin', id: admin.id }, 'admin.mfa_enrolled', { type: 'admin', id: admin.id }, undefined, { ipHash });
  // Shown once on the next page, which then deletes the encrypted copy; only hashes remain.
  redirect('/admin/mfa/recovery-codes');
}

export async function logoutAction() {
  const context = await getAdminContext();
  await endAdminSession();
  if (context) await audit({ type: 'admin', id: context.admin.id }, 'admin.logout', { type: 'admin', id: context.admin.id });
  redirect('/admin/login');
}
