import { expect, test, type Browser, type Page } from '@playwright/test';
import { totp } from '../../src/lib/auth/totp';

const OWNER = { email: 'owner@e2e.test', password: 'e2e-owner-password-1234' };
const STAFF = { email: 'staff@e2e.test', password: 'e2e-staff-password-5678' };

test.describe.configure({ mode: 'serial' });

/** Collects anything that would break the "no third parties, strict CSP" promise. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.host !== 'localhost:3100') problems.push(`third-party request: ${url.host}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/.test(message.text())) problems.push(`CSP: ${message.text()}`);
  });
  return problems;
}

async function signInAndEnrol(browser: Browser, user: { email: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/admin\/mfa\/setup$/);

  // MFA is enforced before any admin page loads.
  await page.goto('/admin/orders');
  await expect(page).toHaveURL(/\/admin\/mfa\/setup$/);

  const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await page.getByLabel('Enter the 6-digit code from the app').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on two-factor authentication' }).click();
  await expect(page.getByTestId('recovery-codes').locator('li')).toHaveCount(10);
  await page.getByRole('link', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  return { context, page };
}

let statusUrl = '';

test('storefront sends strict security headers and loads nothing from third parties', async ({ page }) => {
  const problems = watch(page);
  const response = await page.goto('/');
  const headers = response!.headers();
  expect(headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers['content-security-policy']).not.toContain('unsafe-inline');
  expect(headers['strict-transport-security']).toContain('max-age=63072000');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-powered-by']).toBeUndefined();

  await expect(page.getByRole('heading', { name: 'Built for secure everyday carry.' })).toBeVisible();
  await expect(page.locator('main li')).toHaveCount(8);
  await expect(page.getByText('Out of stock').first()).toBeVisible();
  await page.getByRole('link', { name: 'Ledger Journal' }).click();
  await expect(page.getByText('Sale', { exact: true })).toBeVisible();
  expect(problems).toEqual([]);
});

test('quantity tampering is rejected or capped at real stock', async ({ page }) => {
  async function addTampered(quantity: string) {
    await page.goto('/products/usb-security-key');
    // Bypass the browser's max attribute, as an attacker would.
    await page.getByLabel('Quantity').evaluate((input: HTMLInputElement, value) => {
      input.removeAttribute('max');
      input.value = value;
    }, quantity);
    await page.getByRole('button', { name: 'Add to cart' }).click();
  }

  await addTampered('500');
  await expect(page.getByText('That request was not valid.')).toBeVisible();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();

  await addTampered('50');
  await expect(page.getByText('quantity was capped')).toBeVisible();
  await expect(page.getByLabel('Quantity for USB Security Key')).toHaveValue('3');
  await page.getByRole('button', { name: 'Remove USB Security Key' }).click();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
});

test('customer buys with a discount code and pays through the simulated BTCPay invoice', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/products/reusable-pen');
  await page.getByLabel('Quantity').fill('2');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page).toHaveURL(/\/cart/);

  await page.getByLabel('Discount code').fill('welcome10');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Discount code applied.')).toBeVisible();
  // $30.00 - 10% ($3.00) + $5.00 shipping
  await expect(page.getByTestId('cart-total')).toHaveText('$32.00');

  await page.getByRole('link', { name: 'Checkout' }).click();
  await page.getByRole('button', { name: 'Review order' }).click();
  await expect(page.getByText('This field is required').first()).toBeVisible();

  await page.getByLabel('Email for your confirmation').fill('alice@example.com');
  await page.getByLabel('Full name').fill('Alice Example');
  await page.getByLabel('Address', { exact: true }).fill('1 Test Street');
  await page.getByLabel('City').fill('Springfield');
  await page.getByLabel('Postcode / ZIP').fill('62701');
  await page.getByRole('button', { name: 'Review order' }).click();

  await expect(page).toHaveURL(/\/checkout\/review$/);
  await expect(page.getByText('Alice Example')).toBeVisible();
  await expect(page.getByTestId('summary-total')).toHaveText('$32.00');
  await page.getByRole('button', { name: /^Pay/ }).click();

  await expect(page).toHaveURL(/\/pay\/demo\/demo_/);
  await expect(page.getByText('Demo payment simulator.')).toBeVisible();
  await expect(page.getByText('$32.00')).toBeVisible();
  await page.getByRole('button', { name: 'Payment confirmed' }).click();

  await expect(page).toHaveURL(/\/status\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByTestId('order-status')).toHaveText('Paid');
  await expect(page.getByText('Alice')).toHaveCount(0); // the status page never shows the address
  statusUrl = page.url();
  expect(problems).toEqual([]);
});

test('an expired invoice cancels the order and returns the stock', async ({ page }) => {
  await page.goto('/products/travel-case');
  await expect(page.getByText('14 in stock')).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();
  await page.getByLabel('Email for your confirmation').fill('bob@example.com');
  await page.getByLabel('Full name').fill('Bob Example');
  await page.getByLabel('Address', { exact: true }).fill('2 Test Road');
  await page.getByLabel('City').fill('Shelbyville');
  await page.getByLabel('Postcode / ZIP').fill('12345');
  await page.getByRole('button', { name: 'Review order' }).click();
  await page.getByRole('button', { name: /^Pay/ }).click();
  await expect(page).toHaveURL(/\/pay\/demo\/demo_/);
  const invoiceUrl = page.url();

  // The unit is held while the invoice is open.
  await page.goto('/products/travel-case');
  await expect(page.getByText('13 in stock')).toBeVisible();
  await page.goto(invoiceUrl);
  await page.getByRole('button', { name: 'Let the invoice expire' }).click();
  await expect(page.getByText('Invoice expired')).toBeVisible();
  await page.getByRole('link', { name: 'Return to store' }).click();
  await expect(page.getByTestId('order-status')).toHaveText('Cancelled');

  await page.goto('/products/travel-case');
  await expect(page.getByText('14 in stock')).toBeVisible();
});

test('owner enrols MFA, ships the order, and every action is audited', async ({ browser }) => {
  const { page, context } = await signInAndEnrol(browser, OWNER);
  await expect(page.getByText('Awaiting shipment').locator('..')).toContainText('1');

  await page.getByRole('link', { name: 'Orders' }).first().click();
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await page.locator('tbody tr', { hasText: '$32.00' }).getByRole('link').first().click();
  await page.getByRole('button', { name: 'Show shipping address' }).click();
  await expect(page.getByText('1 Test Street')).toBeVisible();
  await expect(page.getByText('This view was recorded in the audit log.')).toBeVisible();

  await page.getByLabel('Tracking number (optional)').fill('1Z999AA10123456784');
  await page.getByRole('button', { name: 'Mark shipped & email customer' }).click();
  await expect(page.getByText('Order updated.')).toBeVisible();

  await page.getByRole('link', { name: 'Emails' }).click();
  await expect(page).toHaveURL(/\/admin\/emails$/);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('link', { name: 'View' }).last().click();
  await expect(page.getByTestId('email-body')).toContainText('your payment for order');

  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page).toHaveURL(/\/admin\/audit$/);
  for (const action of ['admin.mfa_enrolled', 'order.address_viewed', 'order.status_changed', 'email.viewed']) {
    await expect(page.getByRole('cell', { name: action, exact: true }).first()).toBeVisible();
  }
  await expect(page.locator('body')).not.toContainText('alice@example.com');

  await page.goto(statusUrl);
  await expect(page.getByTestId('order-status')).toHaveText('Shipped');
  await expect(page.getByText('1Z999AA10123456784')).toBeVisible();

  // Owner creates a Staff account for the next test.
  await page.goto('/admin/users');
  await page.getByLabel('Email').fill(STAFF.email);
  await page.getByLabel('Temporary password').fill(STAFF.password);
  await page.getByRole('button', { name: 'Add admin' }).click();
  await expect(page.getByText('Admin created.')).toBeVisible();
  await context.close();
});

test('staff cannot reach owner-only pages or APIs', async ({ browser, baseURL }) => {
  const { page, context } = await signInAndEnrol(browser, STAFF);
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);

  for (const path of ['/admin/settings', '/admin/audit', '/admin/users', '/admin/export', '/admin/emails']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Owner access only' })).toBeVisible();
  }

  // API level: the export endpoint refuses Staff even with a well-formed request.
  const response = await page.request.post('/admin/export/download', {
    form: { from: '2020-01-01', to: '2030-01-01', format: 'csv', method: 'passphrase', passphrase: 'long enough passphrase', confirm: 'long enough passphrase' },
    headers: { origin: baseURL! },
    maxRedirects: 0,
  });
  expect([303, 307]).toContain(response.status());
  expect(response.headers()['location']).toContain('/admin/forbidden');
  expect(response.headers()['content-disposition']).toBeUndefined();
  await context.close();
});

test('protected endpoints reject anonymous callers', async ({ request }) => {
  expect((await request.get('/api/cron/daily')).status()).toBe(401);
  const webhook = await request.post('/api/webhooks/btcpay', { data: { deliveryId: 'x', type: 'InvoiceSettled', invoiceId: 'demo_x' } });
  expect(webhook.status()).toBe(401);
  const admin = await request.get('/admin/orders', { maxRedirects: 0 });
  expect(admin.status()).toBe(303);
  expect(admin.headers()['location']).toContain('/admin/login');
});
