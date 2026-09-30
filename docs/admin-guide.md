# Admin guide

Everything is at **/admin** on your store's address.

## Signing in
1. Enter your email and password.
2. Enter the 6-digit code from your authenticator app. The first time, you scan a QR code and are shown
   **10 recovery codes**. Save them offline; each works once if you lose your phone.
3. After 5 wrong attempts the account locks for 15 minutes. Sessions end after 30 minutes of inactivity.

## Orders
- **Dashboard** shows orders to ship, low-stock products and recent orders.
- **Orders** lists every order; filter by status or date.
- Open an order to see items and totals. **Show shipping address** decrypts the address; every time you do
  this it is written to the audit log.
- **Mark as processing** (optional), then **Mark shipped** with the tracking number. The customer gets an
  email automatically.
- **Refunds:** send the refund from BTCPay Server first, then press **Mark refunded** here.
- If an order is flagged *review*, the customer paid after the invoice expired. Check stock, then ship or
  refund.

## Products and stock
- **Products → New product:** name, SKU, price (like `12.50`), description, starting stock.
- To hide a product, untick **Active**. Deleting is permanent (past orders keep their line items).
- **Adjust stock** with a positive or negative number and a reason; the history shows who changed what.
- *Restricted* is reserved for future notices and has no effect yet.

## Promotions
- **Discount codes:** percent or fixed amount, optional minimum order, maximum uses and expiry date.
- **Item sales:** a percentage off or a fixed sale price for one product, optionally between two dates. If
  several apply, the lowest price wins. Codes apply after sale prices.

## Settings (Owner)
- **Data retention:** personal details are deleted from finished orders after this many days (minimum 7).
- **Shipping:** flat rate and the free-shipping threshold (0 = never free).
- **Hold stock for:** how long items stay reserved while a customer pays.
- **Run purge now** runs the daily clean-up immediately.

## Encrypted export (Owner)
1. **Export:** choose the dates, CSV (for spreadsheets) or JSON, and type a passphrase (four or five random
   words is good). Download the `.age` file.
2. Install **age** once:
   - macOS: install Homebrew from brew.sh, then run `brew install age` in Terminal.
   - Windows: in PowerShell, run `winget install FiloSottile.age`.
3. In Terminal or PowerShell, go to the download folder and run
   `age -d -o orders.csv orders_2026-09-01_2026-09-30.csv.age`, then enter the passphrase.
4. Open `orders.csv`. **Delete it when you're done**, because it contains customers' personal details.

## Admin users (Owner)
Add Staff (orders, products, promotions) or Owners. Give them the temporary password privately; they set up
two-factor authentication on first sign-in. You can disable an account, reset its two-factor
authentication, or change its role. Any change signs that person out everywhere.

## Emails (Owner)
Shows payment and shipping emails. Until an email provider is connected they are captured here instead of
being sent.

## Audit log (Owner)
A read-only record of sign-ins, changes, address views and exports. It never contains customer details.
