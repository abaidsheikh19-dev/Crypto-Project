import type { Metadata } from 'next';
import { z } from 'zod';
import { AdminShell } from '@/src/components/admin-shell';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';

export const metadata: Metadata = { title: 'Audit log' };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const context = await requireAdmin({ role: 'OWNER' });
  const action = z.string().regex(/^[a-z_.]{1,60}$/).optional().catch(undefined).parse((await searchParams).action);
  const entries = await db.auditLog.findMany({
    where: action ? { action: { startsWith: action } } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const adminIds = [...new Set(entries.filter((e) => e.actorType === 'admin' && e.actorId).map((e) => e.actorId!))];
  const admins = new Map((await db.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } })).map((a) => [a.id, a.email]));

  return (
    <AdminShell context={context} title="Audit log">
      <form method="get" className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="action" className="label">Action starts with</label>
          <input id="action" name="action" defaultValue={action} placeholder="admin.login, order., export." className="input" />
        </div>
        <button type="submit" className="btn-secondary">Filter</button>
      </form>
      <p className="mb-3 text-sm text-zinc-500">Read-only. Entries reference IDs only and never contain customer personal data. Showing the latest 200.</p>
      <div className="card overflow-x-auto p-2">
        <table className="table">
          <thead><tr><th>Time (UTC)</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap">{entry.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
                <td>{entry.actorType === 'admin' && entry.actorId ? admins.get(entry.actorId) ?? `admin #${entry.actorId}` : entry.actorType}</td>
                <td className="font-mono text-xs">{entry.action}</td>
                <td className="text-xs">{entry.targetType ? `${entry.targetType} ${entry.targetId}` : '—'}</td>
                <td className="max-w-md break-all font-mono text-xs text-zinc-400">{entry.metadata ? JSON.stringify(entry.metadata) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
