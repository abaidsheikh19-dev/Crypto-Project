import type { Metadata } from 'next';
import { AdminShell, Flash } from '@/src/components/admin-shell';
import { requireAdmin } from '@/src/lib/auth/admin-session';

export const metadata: Metadata = { title: 'Encrypted export' };

const ERRORS: Record<string, string> = {
  passphrase: 'Use a passphrase of at least 12 characters (four or five random words works well).',
  confirm: 'The two passphrases do not match.',
  recipient: 'Paste an age public key - it starts with age1.',
  range: 'The end date must be on or after the start date.',
  invalid: 'Check the form and try again.',
};

export default async function ExportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const context = await requireAdmin({ role: 'OWNER' });
  const error = ERRORS[(await searchParams).error ?? ''];
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  return (
    <AdminShell context={context} title="Encrypted export">
      <Flash message={error} tone="error" />
      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <form action="/admin/export/download" method="post" className="card-pad space-y-5">
          <p className="text-sm text-zinc-400">
            Downloads the orders in a date range, including decrypted names and addresses, as an age-encrypted file.
            The server encrypts it in memory and keeps no copy. Each export is recorded in the audit log.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label htmlFor="from" className="label">From (UTC)</label><input id="from" name="from" type="date" defaultValue={monthAgo} required className="input" /></div>
            <div><label htmlFor="to" className="label">To (UTC)</label><input id="to" name="to" type="date" defaultValue={today} required className="input" /></div>
            <div>
              <label htmlFor="format" className="label">Format</label>
              <select id="format" name="format" className="input"><option value="csv">CSV (spreadsheets)</option><option value="json">JSON</option></select>
            </div>
          </div>
          <fieldset className="space-y-3">
            <legend className="label">Encrypt with</legend>
            <label className="flex items-center gap-2 text-sm text-zinc-200"><input type="radio" name="method" value="passphrase" defaultChecked className="accent-emerald-500" /> A passphrase I type now</label>
            <div className="grid gap-3 pl-6 sm:grid-cols-2">
              <input name="passphrase" type="password" autoComplete="new-password" placeholder="Passphrase (12+ characters)" className="input" />
              <input name="confirm" type="password" autoComplete="new-password" placeholder="Repeat passphrase" className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-200"><input type="radio" name="method" value="recipient" className="accent-emerald-500" /> My age public key</label>
            <div className="pl-6"><input name="recipient" placeholder="age1…" autoComplete="off" className="input font-mono text-xs" /></div>
          </fieldset>
          <button type="submit" className="btn-primary">Download encrypted file</button>
        </form>

        <aside className="card-pad space-y-3 text-sm text-zinc-300">
          <h2 className="font-semibold text-white">Opening the file</h2>
          <p>Install <strong>age</strong> once:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>macOS: <code className="text-emerald-200">brew install age</code></li>
            <li>Windows: <code className="text-emerald-200">winget install FiloSottile.age</code></li>
          </ul>
          <p>Then, in Terminal or PowerShell, from the folder with the download:</p>
          <pre className="overflow-x-auto rounded-xl bg-black/40 p-3 text-xs text-emerald-100">age -d -o orders.csv orders_….csv.age</pre>
          <p>It asks for your passphrase (or add <code>-i key.txt</code> if you used a public key). Delete the decrypted file when you are done with it.</p>
          <p className="text-zinc-500">Full steps: docs/admin-guide.md</p>
        </aside>
      </div>
    </AdminShell>
  );
}
