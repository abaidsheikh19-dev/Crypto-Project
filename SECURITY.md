# Security status and findings log

Last reviewed: 2026-09-30. Architecture and rationale: `docs/security.md`.

## Controls in place (each has a test or a verification step)

| Control | Where | Verified by |
|---|---|---|
| Strict CSP with per-request nonce, no `unsafe-inline` / `unsafe-eval` scripts, `frame-ancestors 'none'` | `middleware.ts`, `src/lib/security/headers.ts` | `tests/security/headers.spec.ts`; e2e asserts headers and zero CSP violations in Chrome |
| HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP, no `X-Powered-By` | same | same |
| No third-party requests (fonts, images, scripts all self-hosted) | whole app | e2e fails on any non-origin request |
| Zod validation on every server action, route and param | `app/**/actions.ts`, routes | unit + e2e (tampered quantity rejected/capped) |
| Prices, discounts, stock and totals computed only on the server | `src/lib/pricing.ts`, `src/lib/orders.ts` | integration: price changed after carting → order uses DB price |
| No oversell under concurrency; discount usage limit atomic | conditional `UPDATE … WHERE stock_qty >= n` | integration: two simultaneous buyers of the last unit |
| Parameterised SQL only | ESLint bans `$queryRawUnsafe` / `$executeRawUnsafe`; no unsafe calls anywhere | lint in CI |
| CSRF | Server Actions (Next.js Origin check) + SameSite cookies; export route checks Origin and `Sec-Fetch-Site` | e2e |
| AES-256-GCM field encryption (random 96-bit nonce, full 128-bit tag, versioned key IDs) for name, email, address, city, region, postcode, country, checkout drafts, emails, TOTP secrets | `src/lib/crypto.ts` | unit (tamper, rotation); integration reads raw rows and finds no plaintext |
| Tokens stored only as SHA-256 hashes (cart, session, order status, recovery codes) | `src/lib/crypto.ts` | unit + schema |
| BTCPay webhook: constant-time HMAC-SHA256 check, size limit, idempotency, invoice re-fetched before acting | `src/lib/payments/webhook.ts` | integration: forged, unsigned, modified, replayed, and "settled" payload for unpaid invoice all change nothing |
| No personal data sent to BTCPay (order ID and number only) | `src/lib/payments/btcpay.ts` | code review |
| Admin auth: separate table/route/cookie (`__Host-`, SameSite=Strict), Argon2id, generic errors + dummy hash (no enumeration), lockout after 5 failures, rate limits | `app/admin/auth-actions.ts` | e2e |
| Mandatory TOTP MFA before any admin page or action; single-use codes (replay-protected); 10 hashed recovery codes shown once | `src/lib/auth/*` | RFC 4226/6238 vectors; e2e shows admin pages redirect to MFA setup |
| Session ID rotated on login and on MFA; 30 min idle / 8 h absolute; server-side | `src/lib/auth/admin-session.ts` | code review + e2e |
| Owner/Staff authorisation checked on every page and action (not just hidden menus) | `requireAdmin({ role })` | e2e: Staff blocked from 5 owner pages and from the export API |
| Audit log (IDs only) for logins, MFA, product/stock/price/promo, status changes, address views, email views, exports, settings, admin users, purges | `src/lib/audit.ts` | e2e checks entries and absence of customer email |
| Retention purge of personal data from finished orders; anonymised totals kept | `src/server/purge.ts` | integration: final vs non-final, inside vs outside window |
| Encrypted export (age, passphrase or public key), built in memory, never written to disk; CSV formula injection neutralised | `src/server/export.ts` | integration decrypts the file; wrong passphrase fails |
| Generic error pages, structured logs without personal data | `app/error.tsx`, `src/lib/log.ts` | code review |
| Dependencies: lockfile, `npm audit` (0 vulnerabilities), Semgrep OWASP rules (0 findings), gitleaks, Actions pinned to commit SHAs | CI | CI |

## Not done yet (planned milestones)

- **Customer accounts** (optional register/login, order history, self-service deletion, inactive-account purge). The schema and purge hooks are ready; the setting exists.
- **Product photo upload** with re-encoding/EXIF stripping – needs private storage on the production server.
- **Production infrastructure**: UltaHost VPS hardening (`infra/`), Cloudflare Full (strict) + WAF, encrypted off-site backups aligned to retention, restore drill, uptime monitoring. The current Vercel + Neon deployment is for demos and staging only.
- **Real BTCPay Server** and an email provider on the client's domain (SPF/DKIM/DMARC).
- Bulk re-encryption script for key rotation (rotation itself already works via `APP_MASTER_KEY_PREVIOUS`).
- OWASP Top 10 / ASVS L2 checklist write-up, ZAP scans, SSL Labs and securityheaders.com grading, load test – Milestone 5.
- Independent third-party pen test (commissioned by the client).

## Accepted deviations

| Item | Reason |
|---|---|
| An encrypted copy of each order's status-page token is kept (`public_token_enc`) | Needed to put the status link in payment and shipping emails. Encrypted like other personal data and deleted by the purge. |
| Demo payment mode accepts simulated payments | Only active when no BTCPay Server is configured; the page and admin clearly say so. Must be off in production (it switches off automatically once `BTCPAY_*` is set). |
| Admin rate limit per email can be used to slow down a specific admin's sign-in | Standard trade-off to stop password guessing; lockout is 15 minutes. |

## Findings log

| Date | Finding | Severity | Status |
|---|---|---|---|
| 2026-09-30 | Webhook accepted any request with a `BTCPay-Sig` header (no HMAC check) | Critical | Fixed – full verification, idempotency, re-fetch |
| 2026-09-30 | Next.js 14.2.15 had a critical advisory | Critical | Fixed – upgraded to 15.5.26; `npm audit` clean |
| 2026-09-30 | Admin login was a GET form with a prefilled password that let anyone in | Critical | Fixed – real auth with mandatory MFA |
| 2026-09-30 | CSP used a fixed placeholder nonce | High | Fixed – per-request nonce |
| 2026-09-30 | Redirects fell back to `http://localhost:3000` in deployments | High (availability) | Fixed – relative redirects via Server Actions |
| 2026-09-30 | Totals ignored item promotions; checkout charged a hard-coded amount | High (integrity) | Fixed – single pricing engine, regression tests |
| 2026-09-30 | Status page showed the customer's email; orders were kept in process memory | Medium | Fixed – DB-backed, no personal data on the page |
| 2026-09-30 | Product images loaded from a third-party CDN | Medium (privacy) | Fixed – self-hosted |
| 2026-09-30 | GCM decryption did not pin the auth tag length (Semgrep) | Medium | Fixed – 16-byte tag enforced |
| 2026-09-30 | Recovery codes could be skipped by a page refresh after MFA enrolment (found by e2e) | Medium | Fixed – dedicated one-time page |
| 2026-09-30 | Empty env vars (e.g. `BTCPAY_URL=`) crashed every page (found by e2e) | Low | Fixed – empty treated as unset |
