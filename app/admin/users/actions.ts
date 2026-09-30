'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/src/lib/db';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { audit } from '@/src/lib/audit';
import { hashPassword, isBreachedPassword, MIN_PASSWORD_LENGTH } from '@/src/lib/auth/password';
import { clientIpHash } from '@/src/lib/request';

export async function inviteAdmin(formData: FormData) {
  const { admin } = await requireAdmin({ role: 'OWNER' });
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email().max(254),
      role: z.enum(['OWNER', 'STAFF']),
      password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
    })
    .safeParse({ email: formData.get('email'), role: formData.get('role'), password: formData.get('password') });
  if (!parsed.success) redirect('/admin/users?msg=invalid');
  if (await isBreachedPassword(parsed.data.password)) redirect('/admin/users?msg=breached');

  try {
    const created = await db.adminUser.create({
      data: { email: parsed.data.email, role: parsed.data.role, passwordHash: await hashPassword(parsed.data.password), recoveryCodeHashes: [] },
    });
    await audit({ type: 'admin', id: admin.id }, 'admin_user.created', { type: 'admin', id: created.id }, { role: created.role }, { ipHash: await clientIpHash() });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') redirect('/admin/users?msg=exists');
    throw error;
  }
  redirect('/admin/users?msg=created');
}

export async function updateAdmin(formData: FormData) {
  const { admin } = await requireAdmin({ role: 'OWNER' });
  const parsed = z
    .object({ id: z.coerce.number().int().positive(), action: z.enum(['disable', 'enable', 'reset_mfa', 'make_owner', 'make_staff']) })
    .safeParse({ id: formData.get('id'), action: formData.get('action') });
  if (!parsed.success) redirect('/admin/users?msg=invalid');
  const { id, action } = parsed.data;
  if (id === admin.id) redirect('/admin/users?msg=self');
  const target = await db.adminUser.findUnique({ where: { id } });
  if (!target) redirect('/admin/users?msg=invalid');

  const data: Prisma.AdminUserUpdateInput =
    action === 'disable' ? { isActive: false }
    : action === 'enable' ? { isActive: true, failedLoginCount: 0, lockedUntil: null }
    : action === 'reset_mfa' ? { totpSecretEnc: null, totpEnabledAt: null, totpLastCounter: null, recoveryCodeHashes: [] }
    : { role: action === 'make_owner' ? 'OWNER' : 'STAFF' };

  await db.$transaction([
    db.adminUser.update({ where: { id }, data }),
    // Any change to access signs the user out everywhere.
    db.session.deleteMany({ where: { subjectType: 'ADMIN', subjectId: id } }),
  ]);
  await audit({ type: 'admin', id: admin.id }, `admin_user.${action}`, { type: 'admin', id }, undefined, { ipHash: await clientIpHash() });
  redirect('/admin/users?msg=updated');
}
