# Client demo script (about 10 minutes)

Use the deployed Vercel URL. Everything below works in demo payment mode – no
real cryptocurrency moves, and the payment page says so.

Before the call: sign in to `/admin` once yourself so two-factor authentication is set up on your phone,
and have the authenticator app ready.

## 1. The shop (2 min)
- Home page: plain dark green/black design, no sliders, ads or trackers. Point out the **Out of stock** and
  **Sale** badges – both come from the database.
- Open **Ledger Journal**: sale price with the original price struck through.

## 2. Cart and discounts (2 min)
- Add **Reusable Pen** ×2. In the cart, apply code `welcome10` (codes are case-insensitive).
- Totals are recalculated on the server every time: $30.00 − $3.00 + $5.00 shipping = **$32.00**.
- Try a made-up code – it is refused, and repeated guessing is rate-limited.

## 3. Checkout and payment (3 min)
- Checkout asks only for email, name and shipping address. No account needed.
- The review page shows everything once more, then **Pay with crypto**.
- The payment page stands in for BTCPay Server. It shows the BTC amount and QR code. Click
  **Payment confirmed**: behind the scenes this sends a signed webhook, the store verifies the
  signature, re-checks the invoice and only then marks the order paid.
- You land on the **order status page** – a private, unguessable link that shows progress and items but
  never the address.
- (Optional) Place a second order and click **Let the invoice expire** – the order cancels and the stock
  comes back.

## 4. Admin (3 min)
- `/admin`: password, then the 6-digit code. Two-factor authentication is mandatory for every admin.
- **Dashboard:** awaiting shipment, low-stock alerts, recent orders.
- **Orders → the order:** the address is encrypted; **Show shipping address** decrypts it and records that
  in the audit log. Add a tracking number → **Mark shipped & email customer**.
- **Emails:** the payment confirmation and shipped emails (captured here until an email provider is connected).
- **Products:** edit a price, adjust stock with a reason – the history shows who changed what.
- **Promotions:** create a code or a sale.
- **Settings:** retention window (default 30 days) and shipping rate; **Run purge now**.
- **Export:** date range + passphrase → an encrypted file only the owner can open.
- **Audit log:** every sign-in, address view, status change and export – with no customer data in it.

## What to say is still to come
- Connecting the client's own BTCPay Server (real BTC / Lightning), and an email provider on their domain.
- Optional customer accounts with order history.
- Product photo upload (arrives with the production server).
- The production VPS with Cloudflare, encrypted off-site backups, and the independent pen test.
