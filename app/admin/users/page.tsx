import type { Metadata } from 'next';
import { AdminShell, Flash } from '@/src/components/admin-shell';
import { SubmitButton } from '@/src/components/submit-button';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { inviteAdmin, updateAdmin } from './actions';

export const metadata: Metadata = { title: 'Admin users' };

const MESSAGES: Record<string, { text: string; tone: 'info' | 'error' }> = {
  created: { text: 'Admin created. Share the temporary password privately - they set up two-factor authentication on first sign-in.', tone: 'info' },
  updated: { text: 'Admin updated and signed out of any open sessions.', tone: 'info' },
  invalid: { text: 'Check the details. Passwords need at least 12 characters.', tone: 'error' },
  breached: { text: 'That password appears in known data breaches. Choose another.', tone: 'error' },
  exists: { text: 'An admin with that email already exists.', tone: 'error' },
  self: { text: 'You cannot change your own access here.', tone: 'error' },
};

function Action({ id, action, label, danger }: { id: number; action: string; label: string; danger?: boolean }) {
  return (
    <form action={updateAdmin} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <button type="submit" className={`text-xs ${danger ? 'text-red-300 hover:text-red-200' : 'link'}`}>{label}</button>
    </form>
  );
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const context = await requireAdmin({ role: 'OWNER' });
  const admins = await db.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
  const message = MESSAGES[(await searchParams).msg ?? ''];

  return (
    <AdminShell context={context} title="Admin users">
      <Flash message={message?.text} tone={message?.tone} />
      <div className="card mb-6 overflow-x-auto p-2">
        <table className="table">
          <thead><tr><th>Email</th><th>Role</th><th>2FA</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.email}{a.id === context.admin.id ? <span className="text-zinc-500"> (you)</span> : null}</td>
                <td>{a.role === 'OWNER' ? 'Owner' : 'Staff'}</td>
                <td>{a.totpEnabledAt ? 'On' : <span className="text-amber-200">Not set up</span>}</td>
                <td>{a.isActive ? (a.lockedUntil && a.lockedUntil > new Date() ? 'Locked' : 'Active') : 'Disabled'}</td>
                <td>{a.lastLoginAt ? a.lastLoginAt.toISOString().slice(0, 16).replace('T', ' ') : '—'}</td>
                <td className="space-x-3 whitespace-nowrap">
                  {a.id === context.admin.id ? null : (
                    <>
                      {a.isActive ? <Action id={a.id} action="disable" label="Disable" danger /> : <Action id={a.id} action="enable" label="Enable" />}
                      <Action id={a.id} action="reset_mfa" label="Reset 2FA" />
                      {a.role === 'STAFF' ? <Action id={a.id} action="make_owner" label="Make owner" /> : <Action id={a.id} action="make_staff" label="Make staff" />}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={inviteAdmin} className="card-pad grid gap-3 sm:grid-cols-4 sm:items-end">
        <div><label htmlFor="email" className="label">Email</label><input id="email" name="email" type="email" required className="input" /></div>
        <div>
          <label htmlFor="role" className="label">Role</label>
          <select id="role" name="role" className="input"><option value="STAFF">Staff</option><option value="OWNER">Owner</option></select>
        </div>
        <div><label htmlFor="password" className="label">Temporary password</label><input id="password" name="password" type="password" minLength={12} required autoComplete="new-password" className="input" /></div>
        <SubmitButton>Add admin</SubmitButton>
      </form>
    </AdminShell>
  );
}
