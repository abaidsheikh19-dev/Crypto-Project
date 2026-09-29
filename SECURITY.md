# Security status

This document records the current release status of the prototype and the remaining human-only tasks required for live deployment.

## Completed baseline
- Hardened baseline app shell with security headers and CSP defaults.
- Docker local environment for app and Postgres.
- CI pipeline for lint, typecheck, and tests.
- Placeholder health endpoint.
- Project-level backup and provisioning scripts.

## Outstanding human-only actions
- Acquire and configure the UltaHost VPS, domain, Cloudflare, GitHub, email, and backup accounts in the client’s name.
- Set DNS records for the domain, staging, and BTCPay domains.
- Create the live BTCPay store, wallet, and offline wallet seed handling.
- Upgrade Cloudflare Pro and enable OWASP managed ruleset.
- Complete production key and secret configuration in `.env` outside the web root.

## Remediation log
- No critical or high vulnerabilities are currently known in the prototype codebase, but the live production and third-party security review is still pending.
- All production-grade security controls must be re-reviewed before public launch.
