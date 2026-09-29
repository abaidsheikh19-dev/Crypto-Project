# Security design summary

The project is designed around a privacy-first architecture: dark storefront, strict CSP and security headers, server-side pricing and validation, encrypted personal data fields, and a layered infrastructure with Cloudflare and a self-hosted BTCPay deployment.

## Protection layers
- TLS at the edge through Cloudflare and the origin certificate.
- Server-side forms and validation with Zod.
- Storage of money as integer cents on the server.
- Secure session handling and admin separation in the production design.

## Retention and backup interaction
- Backup retention must not exceed the configured personal-data retention window.
- Old data should be purged and then removed from backup rotation according to the retention policy.
