import type { Metadata } from 'next';
import { AdminShell, Flash } from '@/src/components/admin-shell';
import { SubmitButton } from '@/src/components/submit-button';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { getMeta, getSettings } from '@/src/lib/settings';
import { centsToDollarsInput } from '@/src/lib/money';
import type { PurgeSummary } from '@/src/server/purge';
import { runPurgeNow, saveSettings } from './actions';

export const metadata: Metadata = { title: 'Settings' };

const MESSAGES: Record<string, { text: string; tone: 'info' | 'error' }> = {
  saved: { text: 'Settings saved.', tone: 'info' },
  invalid: { text: 'Check the values: retention is at least 7 days, amounts look like 5.00.', tone: 'error' },
  purged: { text: 'Purge finished.', tone: 'info' },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const context = await requireAdmin({ role: 'OWNER' });
  const settings = await getSettings();
  const lastRunRaw = await getMeta('purge_last_run');
  const lastRun = lastRunRaw ? (JSON.parse(lastRunRaw) as PurgeSummary) : null;
  const message = MESSAGES[(await searchParams).msg ?? ''];

  return (
    <AdminShell context={context} title="Settings">
      <Flash message={message?.text} tone={message?.tone} />
      <div className="grid gap-6 xl:grid-cols-2">
        <form action={saveSettings} className="card-pad space-y-5">
          <div>
            <h2 className="font-semibold text-white">Data retention</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Names, emails and addresses are deleted from finished orders (shipped, cancelled, refunded) once they are older than this.
              Keep backup retention no longer than this window - see docs/security.md.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="retention_days" className="label">Order data retention (days, min 7)</label>
              <input id="retention_days" name="retention_days" type="number" min={7} defaultValue={settings.retention_days} className="input" />
            </div>
            <div>
              <label htmlFor="inactive_account_days" className="label">Inactive customer accounts (days)</label>
              <input id="inactive_account_days" name="inactive_account_days" type="number" min={30} defaultValue={settings.inactive_account_days} className="input" />
            </div>
          </div>
          <h2 className="border-t border-white/10 pt-5 font-semibold text-white">Shipping and checkout</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="shipping_flat" className="label">Flat shipping ($)</label>
              <input id="shipping_flat" name="shipping_flat" defaultValue={centsToDollarsInput(settings.shipping_flat_cents)} className="input" />
            </div>
            <div>
              <label htmlFor="free_shipping_threshold" className="label">Free shipping from ($, 0 = never)</label>
              <input id="free_shipping_threshold" name="free_shipping_threshold" defaultValue={centsToDollarsInput(settings.free_shipping_threshold_cents)} className="input" />
            </div>
            <div>
              <label htmlFor="reservation_minutes" className="label">Hold stock for (minutes)</label>
              <input id="reservation_minutes" name="reservation_minutes" type="number" min={5} defaultValue={settings.reservation_minutes} className="input" />
            </div>
          </div>
          <SubmitButton>Save settings</SubmitButton>
        </form>

        <section className="card-pad space-y-4">
          <h2 className="font-semibold text-white">Retention purge</h2>
          <p className="text-sm text-zinc-400">Runs automatically every day. You can also run it now.</p>
          {lastRun ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-300">
              <dt className="text-zinc-400">Last run</dt><dd>{lastRun.ranAt.slice(0, 16).replace('T', ' ')} UTC</dd>
              <dt className="text-zinc-400">Orders purged</dt><dd>{lastRun.ordersPurged}</dd>
              <dt className="text-zinc-400">Unfinished, past window</dt><dd>{lastRun.staleOpenOrders}</dd>
              <dt className="text-zinc-400">Emails deleted</dt><dd>{lastRun.emailsDeleted}</dd>
              <dt className="text-zinc-400">Expired carts / sessions</dt><dd>{lastRun.cartsDeleted} / {lastRun.sessionsDeleted}</dd>
            </dl>
          ) : <p className="text-sm text-zinc-500">The purge has not run yet.</p>}
          <form action={runPurgeNow}>
            <SubmitButton className="btn-secondary">Run purge now</SubmitButton>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
