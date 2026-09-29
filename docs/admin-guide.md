# Admin guide

This prototype includes a basic dashboard stub for products, stock, promotions, and orders. The live production version should be configured by the client with the operational policies and retention windows agreed during handoff.

## Product workflow
- Add products by creating a catalog entry with name, price, stock, and sale windows.
- Use high-quality product photos after handoff.
- Keep the admin route separate from the storefront and require MFA in production.

## Orders
- Review pending transaction states and use the status flow defined in the project specification.
- Mark orders shipped and include tracking numbers when available.

## Retention and export
- Use the retention configuration to purge eligible personal data after the configured window.
- Encrypted exports should be decrypted with the age passphrase or public key saved by the owner.
