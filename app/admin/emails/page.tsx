import type { Metadata } from 'next';
import { z } from 'zod';
import { AdminShell } from '@/src/components/admin-shell';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { db } from '@/src/lib/db';
import { decrypt } from '@/src/lib/crypto';
import { audit } from '@/src/lib/audit';
import { env } from '@/src/lib/env';
import { clientIpHash } from '@/src/lib/request';

export const metadata: Metadata = { title: 'Emails' };

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const context = await requireAdmin({ role: 'OWNER' });
  const emails = await db.emailOutbox.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  const viewId = z.coerce.number().int().positive().safeParse((await searchParams).view);
  const selected = viewId.success ? emails.find((email) => email.id === viewId.data) : undefined;
  if (selected) {
    await audit({ type: 'admin', id: context.admin.id }, 'email.viewed', { type: 'email', id: selected.id }, { orderId: selected.orderId }, { ipHash: await clientIpHash() });
  }
  const providerConfigured = Boolean(env().RESEND_API_KEY && env().EMAIL_FROM);

  return (
    <AdminShell context={context} title="Emails">
      <p className="notice-info mb-6">
        {providerConfigured
          ? 'Emails are sent through the configured provider. Failed sends are retried automatically.'
          : 'No email provider is configured yet, so emails are captured here instead of being sent. Add RESEND_API_KEY and EMAIL_FROM to send them for real.'}
      </p>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="card overflow-x-auto p-2">
          {emails.length === 0 ? <p className="p-4 text-sm text-zinc-400">No emails yet.</p> : (
            <table className="table">
              <thead><tr><th>Created (UTC)</th><th>Template</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {emails.map((email) => (
                  <tr key={email.id}>
                    <td>{email.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                    <td>{email.template.replace('_', ' ')}</td>
                    <td>{email.status.toLowerCase()}{email.attempts > 1 ? ` (${email.attempts} tries)` : ''}</td>
                    <td><a href={`?view=${email.id}`} className="link text-xs">View</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {selected ? (
          <article className="card-pad text-sm">
            <p className="text-zinc-400">To: <span className="text-zinc-200">{decrypt(selected.toEnc)}</span></p>
            <p className="mt-1 text-zinc-400">Subject: <span className="text-zinc-200">{decrypt(selected.subjectEnc)}</span></p>
            <pre data-testid="email-body" className="mt-4 whitespace-pre-wrap rounded-xl bg-black/30 p-4 font-sans leading-6 text-zinc-200">{decrypt(selected.bodyTextEnc)}</pre>
            <p className="mt-3 text-xs text-zinc-500">Viewing an email is recorded in the audit log.</p>
          </article>
        ) : null}
      </div>
    </AdminShell>
  );
}
