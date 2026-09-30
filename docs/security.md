# Security architecture

## Data flow

```
Browser ──HTTPS──> Next.js (Vercel now, VPS behind Cloudflare later)
                     │  middleware: CSP nonce + security headers on every response
                     │  server actions: Zod validation → authorisation → domain logic
                     ├──> PostgreSQL (personal data encrypted per field)
                     ├──> BTCPay Server (order ID + amount only)  <── signed webhook
                     └──> Email provider (via encrypted outbox)
```

## What protects what

| Asset | Protection |
|---|---|
| Customer name, email, address | AES-256-GCM per field with a random nonce; key derived (HKDF) from `APP_MASTER_KEY`, which lives only in environment variables. Decrypted only on the admin order view (audited), in emails, and in the owner's encrypted export. Deleted by the retention purge. |
| Order status links | 256 random bits; only the SHA-256 hash is stored; `Referrer-Policy: no-referrer` on the page; the page never shows address or email. |
| Payments | Invoice status changes only after the webhook signature verifies **and** the invoice is re-fetched from BTCPay. Replays are ignored. Stock is reserved atomically at checkout and released on expiry (webhook, status-page sync, or the daily fallback job). |
| Admin panel | Separate accounts, Argon2id, mandatory TOTP, lockout, rate limits, SameSite=Strict `__Host-` cookie, short sessions, role checks in every page and action, audit log. |
| Prices and stock | Recomputed from the database on every view and inside the checkout transaction. The client never sends prices. |
| Browser | Strict nonce-based CSP, no third-party origins, no inline event handlers, framing blocked. |

## Keys

- `APP_MASTER_KEY` (32 random bytes). Sub-keys are derived for field encryption, lookup HMACs, IP hashing and the demo webhook secret.
- Every ciphertext records the ID of the key that produced it (`v1.<keyId>.…`).
- **Rotation:** see `docs/operations.md`. Losing the key makes stored personal data unrecoverable. Keep an offline copy.

## Retention and backups

- The purge removes personal data from **finished** orders (shipped, cancelled, refunded) older than the retention window (default 30 days, minimum 7). Unfinished orders past the window are flagged on the dashboard instead.
- Anonymous order rows (number, date, items, totals, status) remain for stock and sales figures.
- **Backups must not outlive the retention window**, or purged data survives in old backups. On Neon, keep point-in-time restore history ≤ the retention window (the free plan keeps about a day). On the VPS, the backup rotation in `infra/backup.sh` must be set to the same number of days.
- The encrypted export is the client's own offline copy. Its retention is the client's responsibility, and it's documented in the admin guide.
