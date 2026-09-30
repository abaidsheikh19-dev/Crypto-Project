# Cipher Supply – secure crypto-payment store

A custom Next.js storefront where customers buy physical products and pay in
Bitcoin and other cryptocurrencies through a self-hosted **BTCPay Server**.
Privacy and security come first: guest checkout, no trackers, personal data
encrypted in the database and deleted automatically after a retention window.

The project spec is the source of truth; this README covers running and deploying it.

## What works today

| Area | Status |
|---|---|
| Catalogue, product pages, out-of-stock handling | ✅ from Postgres |
| Server-side cart (HttpOnly cookie token), quantity capped at stock | ✅ |
| Pricing engine: item sales, discount codes, free-shipping threshold, integer cents | ✅ 100% unit-tested |
| Checkout → review → atomic stock reservation → invoice | ✅ concurrency-tested |
| BTCPay Greenfield client + signed webhook (HMAC, replay-safe, re-fetches invoice) | ✅ code complete; runs in **demo mode** until a BTCPay Server is connected |
| Order status page on an unguessable 256-bit link | ✅ never shows the address |
| Emails (payment confirmed, shipped) via outbox with retries | ✅ captured in Admin → Emails until an email provider is added |
| Admin: separate login, Argon2id, **mandatory TOTP MFA**, recovery codes, lockout, Owner/Staff roles | ✅ |
| Admin: orders, products & stock history, promotions, settings, admin users, audit log | ✅ |
| Retention purge (daily + "run now"), encrypted **age** export | ✅ |
| Strict CSP with per-request nonces, HSTS, no third-party requests | ✅ |
| Customer accounts, product photo upload, VPS/Cloudflare/backups | ⏳ later milestones – see `SECURITY.md` |

## Run it locally

Needs Node 20+. No Docker required – a real PostgreSQL runs from `node_modules`.

```bash
npm install
cp .env.example .env
npm run gen:secrets          # paste APP_MASTER_KEY into .env, and set ADMIN_PASSWORD (12+ chars)
npm run db:local             # terminal 1: starts Postgres on :54329 (leave it running)
npm run db:migrate           # terminal 2
npm run db:seed              # 8 demo products, a sale, codes WELCOME10 and SAVE5, and the owner admin
npm run dev                  # http://localhost:3000
```

Sign in at <http://localhost:3000/admin> with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. On first sign-in
you set up an authenticator app (Google Authenticator, 1Password, Aegis…).

## Tests

```bash
npm run lint && npm run typecheck
npm test                     # unit: pricing, crypto, TOTP (RFC vectors), webhook signatures, headers
npm run test:integration     # against a throwaway Postgres: checkout, oversell race, webhooks, expiry, purge, export
npm run build && npm run test:e2e   # Playwright in Chrome: the full shop → pay → admin journey
```

CI (`.github/workflows/ci.yml`) runs all of the above plus `npm audit`, gitleaks and Semgrep on every push and PR.

## Deploy to Vercel (free tier)

1. **Import the repo** in Vercel (Add New → Project → pick this GitHub repo). Framework: Next.js – leave the
   build settings alone; Vercel runs `npm run vercel-build`, which migrates the database, seeds it and builds.
2. **Add a database:** Project → *Storage* → *Create Database* → **Neon** (free) → connect it to the project.
   This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
3. **Add environment variables** (Project → Settings → Environment Variables), for Production and Preview:
   - `APP_MASTER_KEY` – from `npm run gen:secrets`. **Save a copy somewhere safe**; without it the stored
     customer data cannot be decrypted.
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` – the first Owner account (password 12+ characters).
   - `CRON_SECRET` – from `npm run gen:secrets` (lets the daily cleanup job run).
   - Optional: `CONTACT_EMAIL`, `APP_URL` (your custom domain).
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the build sees the new variables.
5. Open the site, then `/admin` to sign in and set up two-factor authentication.

If the build stops with "Missing environment variables", step 2 or 3 was skipped – the log names what is missing.

**Taking real payments later:** set `BTCPAY_URL`, `BTCPAY_STORE_ID`, `BTCPAY_API_KEY` and
`BTCPAY_WEBHOOK_SECRET` (see `docs/operations.md`). The demo payment simulator switches off automatically.
**Sending real email:** set `RESEND_API_KEY` and `EMAIL_FROM`.

## Project layout

```
app/            routes: storefront, checkout, status page, admin, api (webhook, cron, health)
src/lib/        pricing, crypto, cart, orders, payments (btcpay, demo, webhook), email, auth, audit, rate limits
src/server/     purge and export jobs
prisma/         schema, migrations, idempotent seed
tests/          unit, integration (real Postgres), e2e (Playwright)
docs/           operations, admin guide, security architecture, pentest brief, Cloudflare
infra/          VPS provisioning / backup script outlines for the production milestone
DEMO.md         a 10-minute walkthrough for showing the store to the client
```
