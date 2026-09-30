import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { decrypt, encrypt, hashToken, lookupHmac, needsReencryption, orderNumber, randomToken, resetKeyringForTests, safeEqual } from '../../src/lib/crypto';
import { resetEnvForTests } from '../../src/lib/env';
import { signBody, verifySignature } from '../../src/lib/payments/webhook';

const keyA = randomBytes(32).toString('base64');
const keyB = randomBytes(32).toString('base64');

function useKeys(current: string, previous?: string) {
  process.env.DATABASE_URL = 'postgresql://unused';
  process.env.APP_MASTER_KEY = current;
  if (previous) process.env.APP_MASTER_KEY_PREVIOUS = previous;
  else delete process.env.APP_MASTER_KEY_PREVIOUS;
  resetEnvForTests();
  resetKeyringForTests();
}

describe('field encryption (AES-256-GCM)', () => {
  beforeEach(() => useKeys(keyA));

  it('round-trips unicode text', () => {
    const value = 'Zoë Müller, 12 Rue de l’Église';
    expect(decrypt(encrypt(value))).toBe(value);
  });

  it('uses a fresh nonce every time, so equal values never look equal', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
    expect(a.split('.')[2]).not.toBe(b.split('.')[2]);
    expect(a).not.toContain('same');
  });

  it('detects tampering', () => {
    const parts = encrypt('secret').split('.');
    const flipped = Buffer.from(parts[3], 'base64url');
    flipped[0] ^= 1;
    parts[3] = flipped.toString('base64url');
    expect(() => decrypt(parts.join('.'))).toThrow();
    expect(() => decrypt('garbage')).toThrow('Unrecognised ciphertext format');
  });

  it('supports key rotation through APP_MASTER_KEY_PREVIOUS', () => {
    const old = encrypt('rotate me');
    useKeys(keyB);
    expect(() => decrypt(old)).toThrow('unknown key');
    useKeys(keyB, keyA);
    expect(decrypt(old)).toBe('rotate me');
    expect(needsReencryption(old)).toBe(true);
    expect(needsReencryption(encrypt('new'))).toBe(false);
  });

  it('produces stable keyed lookups that ignore case and whitespace', () => {
    expect(lookupHmac(' Owner@Example.com ')).toBe(lookupHmac('owner@example.com'));
    expect(lookupHmac('a@example.com')).not.toBe(lookupHmac('b@example.com'));
  });
});

describe('tokens', () => {
  it('generates 256-bit URL-safe tokens and stores only hashes', () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });

  it('compares in constant time', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('makes readable order numbers', () => {
    expect(orderNumber()).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  });
});

describe('BTCPay webhook signatures', () => {
  const body = JSON.stringify({ deliveryId: 'd1', type: 'InvoiceSettled', invoiceId: 'inv' });

  it('accepts a correct sha256 HMAC', () => {
    expect(verifySignature(body, signBody(body, 'secret'), 'secret')).toBe(true);
    expect(verifySignature(body, signBody(body, 'secret').toUpperCase().replace('SHA256=', 'sha256='), 'secret')).toBe(true);
  });

  it('rejects missing, malformed, wrong-secret and modified-body signatures', () => {
    expect(verifySignature(body, null, 'secret')).toBe(false);
    expect(verifySignature(body, 'sha256=nothex', 'secret')).toBe(false);
    expect(verifySignature(body, signBody(body, 'other'), 'secret')).toBe(false);
    expect(verifySignature(body + ' ', signBody(body, 'secret'), 'secret')).toBe(false);
    expect(verifySignature(body, signBody(body, ''), '')).toBe(false);
  });
});
