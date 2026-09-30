# Operations

## Deploying

- **Vercel (demo / staging):** push to GitHub. Every push builds a preview; `main` deploys to production.
  The build runs `prisma migrate deploy` and the idempotent seed before `next build`
  (`scripts/vercel-build.mjs`). Setup steps: `README.md` → "Deploy to Vercel".
- **Roll back:** Vercel → Deployments → pick the previous deployment → *Promote to Production*. Database
  migrations are additive; if one ever isn't, restore the database first (below).
- **Production VPS** (later milestone): `infra/` holds the provisioning and backup outlines.

## Scheduled jobs

`vercel.json` calls `/api/cron/daily` at 03:00 UTC with `Authorization: Bearer $CRON_SECRET`. It:
1. cancels unpaid orders whose invoices expired (the fallback in case a webhook was missed);
2. retries queued emails;
3. runs the retention purge.

The Owner can also run the purge from **Admin → Settings**.

## Connecting BTCPay Server (real payments)

1. In BTCPay: create the store and wallet (seed phrase stored **offline**, never on a server).
2. Account → API keys → new key with only **View invoices** and **Create invoice** for this store.
3. Store → Webhooks → add `https://<your-domain>/api/webhooks/btcpay`, events *Invoice processing /
   settled / expired / invalid*. Copy the secret.
4. Set `BTCPAY_URL`, `BTCPAY_STORE_ID`, `BTCPAY_API_KEY`, `BTCPAY_WEBHOOK_SECRET` and redeploy.
   Demo payments switch off automatically; the admin banner disappears.

## Email

Set `RESEND_API_KEY` and `EMAIL_FROM` (an address on a domain verified in Resend with SPF, DKIM and
DMARC). Until then, emails are captured in **Admin → Emails**. Failed sends retry up to 5 times.

## Rotating secrets

- **`CRON_SECRET`, `BTCPAY_API_KEY`, `BTCPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`:** replace the value in the
  provider and in Vercel, then redeploy.
- **`APP_MASTER_KEY`:**
  1. Set `APP_MASTER_KEY_PREVIOUS` to the current key.
  2. Set `APP_MASTER_KEY` to a new one (`npm run gen:secrets`) and redeploy. New data uses the new key;
     old data still decrypts with the previous key.
  3. Once no old values remain (for example after one retention window, when old orders are purged),
     remove `APP_MASTER_KEY_PREVIOUS`. A bulk re-encryption script is planned so this can happen
     immediately.
  4. Sign-ins are unaffected. Pending (unenrolled) TOTP secrets and checkout drafts encrypted with the old
     key keep working while the previous key is set.

## Database backup and restore

- **Neon:** use *Branches → Restore* (point in time) or create a branch from a timestamp. Keep history no
  longer than the retention window (see `docs/security.md`).
- **Manual dump:** `pg_dump "$DATABASE_URL_UNPOOLED" | age -r <owner-public-key> > backup.sql.age`.
  Restore with `age -d -i key.txt backup.sql.age | psql "$DATABASE_URL_UNPOOLED"`.

## Health

`GET /api/health` returns `{"status":"ok","database":true}`, or HTTP 503 if the database is unreachable.
Point an external uptime monitor at it.
