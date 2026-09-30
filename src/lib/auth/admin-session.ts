import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AdminRole, AdminUser } from '@prisma/client';
import { db } from '../db';
import { hashToken, randomToken } from '../crypto';

/**
 * Admin sessions are stored server-side (only a hash of the session ID is in
 * the database), use their own SameSite=Strict cookie, and time out after 30
 * minutes idle or 8 hours total. A session is created after the password step
 * with `mfaPassed = false` and replaced by a fresh one once MFA succeeds.
 */

const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const PENDING_MFA_MS = 10 * 60 * 1000;

export const ADMIN_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';

export type AdminContext = {
  admin: Pick<AdminUser, 'id' | 'email' | 'role' | 'totpEnabledAt'>;
  mfaPassed: boolean;
  sessionHash: string;
};

async function setCookie(token: string, maxAgeMs: number) {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

/** Server actions only. Always issues a brand-new session ID (no fixation). */
export async function startAdminSession(adminId: number, mfaPassed: boolean) {
  const existing = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (existing) await db.session.deleteMany({ where: { idHash: hashToken(existing) } });

  const token = randomToken();
  const lifetime = mfaPassed ? ABSOLUTE_MS : PENDING_MFA_MS;
  await db.session.create({
    data: {
      idHash: hashToken(token),
      subjectType: 'ADMIN',
      subjectId: adminId,
      mfaPassed,
      expiresAt: new Date(Date.now() + lifetime),
    },
  });
  await setCookie(token, lifetime);
}

export async function endAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { idHash: hashToken(token) } });
  store.delete(ADMIN_COOKIE);
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const idHash = hashToken(token);
  const session = await db.session.findUnique({ where: { idHash } });
  const now = Date.now();
  if (!session || session.subjectType !== 'ADMIN' || session.expiresAt.getTime() <= now || session.lastSeenAt.getTime() + IDLE_MS <= now) {
    return null;
  }
  const admin = await db.adminUser.findUnique({
    where: { id: session.subjectId },
    select: { id: true, email: true, role: true, totpEnabledAt: true, isActive: true },
  });
  if (!admin?.isActive) return null;

  if (now - session.lastSeenAt.getTime() > 60_000) {
    await db.session.update({ where: { idHash }, data: { lastSeenAt: new Date(now) } });
  }
  return { admin, mfaPassed: session.mfaPassed && admin.totpEnabledAt !== null, sessionHash: idHash };
}

export function hasRole(role: AdminRole, required: AdminRole | undefined): boolean {
  if (!required) return true;
  return required === 'STAFF' ? role === 'STAFF' || role === 'OWNER' : role === 'OWNER';
}

/**
 * Gate for every admin page and server action. Redirects to login or MFA
 * unless the session has completed MFA, and blocks Staff from Owner-only areas.
 */
export async function requireAdmin(options: { role?: AdminRole } = {}): Promise<AdminContext> {
  const context = await getAdminContext();
  if (!context) redirect('/admin/login');
  if (!context.mfaPassed) redirect(context.admin.totpEnabledAt ? '/admin/mfa' : '/admin/mfa/setup');
  if (!hasRole(context.admin.role, options.role)) redirect('/admin/forbidden');
  return context;
}
