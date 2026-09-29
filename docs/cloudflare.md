# Cloudflare setup

This project assumes the client creates and owns the Cloudflare account, domain, and origin infrastructure. The live environment should be secured as follows:

1. Use the domain registrar and Cloudflare for the production domain and staging subdomain.
2. Create DNS records for the root domain, staging, and BTCPay subdomain
3. Enable Full (Strict) SSL mode with an origin certificate.
4. Turn on Authenticated Origin Pulls.
5. Keep Always Use HTTPS enabled.
6. Apply the OWASP managed ruleset once the client upgrades to Cloudflare Pro.
7. Add a stricter rate-limit or challenge rule on `/admin` and `/api/auth/*`.
8. Keep the origin on a non-public IP and restrict it to Cloudflare IP ranges at the VPS firewall.

This repository contains the initial baseline. The live Cloudflare configuration is a human-administered step because it requires the client-controlled account and domain access.
