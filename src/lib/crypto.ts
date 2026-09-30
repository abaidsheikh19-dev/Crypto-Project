import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/**
 * Field-level encryption for personal data.
 *
 * Ciphertext format: `v1.<keyId>.<iv>.<ciphertext>.<tag>` (base64url parts).
 * `keyId` identifies which master key produced the value, so APP_MASTER_KEY can
 * be rotated: move the old key to APP_MASTER_KEY_PREVIOUS, set a new one, and
 * values encrypted under either key keep decrypting (see docs/operations.md).
 */

type Purpose = 'pii' | 'lookup-hmac' | 'ip-hmac' | 'mock-webhook';

function deriveKey(master: Buffer, purpose: Purpose): Buffer {
  return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), `crypto-store:${purpose}:v1`, 32));
}

function keyIdOf(master: Buffer): string {
  return createHash('sha256').update(master).digest('base64url').slice(0, 8);
}

type Keyring = { currentId: string; keys: Map<string, Buffer> };

let keyring: Keyring | undefined;

function getKeyring(): Keyring {
  if (keyring) return keyring;
  const e = env();
  const current = Buffer.from(e.APP_MASTER_KEY, 'base64');
  const keys = new Map<string, Buffer>([[keyIdOf(current), current]]);
  if (e.APP_MASTER_KEY_PREVIOUS) {
    const previous = Buffer.from(e.APP_MASTER_KEY_PREVIOUS, 'base64');
    keys.set(keyIdOf(previous), previous);
  }
  keyring = { currentId: keyIdOf(current), keys };
  return keyring;
}

function currentMaster(): Buffer {
  const ring = getKeyring();
  return ring.keys.get(ring.currentId)!;
}

export function encrypt(plaintext: string): string {
  const ring = getKeyring();
  const key = deriveKey(currentMaster(), 'pii');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', ring.currentId, iv.toString('base64url'), ciphertext.toString('base64url'), tag.toString('base64url')].join('.');
}

export function decrypt(value: string): string {
  const parts = value.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') throw new Error('Unrecognised ciphertext format');
  const [, keyId, ivPart, ctPart, tagPart] = parts;
  const master = getKeyring().keys.get(keyId);
  if (!master) throw new Error('Ciphertext was encrypted with an unknown key');
  const tag = Buffer.from(tagPart, 'base64url');
  // Require the full 128-bit tag so a truncated tag can never be accepted.
  if (tag.length !== 16) throw new Error('Invalid authentication tag');
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(master, 'pii'), Buffer.from(ivPart, 'base64url'), { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(ctPart, 'base64url')), decipher.final()]).toString('utf8');
}

export const encryptOptional = (value: string | null | undefined) => (value ? encrypt(value) : null);
export const decryptOptional = (value: string | null | undefined) => (value ? decrypt(value) : null);

/** True when the value was encrypted with an older key and should be re-encrypted. */
export function needsReencryption(value: string): boolean {
  return value.split('.')[1] !== getKeyring().currentId;
}

/** Keyed hash for lookups on encrypted values (for example email addresses). */
export function lookupHmac(value: string): string {
  return createHmac('sha256', deriveKey(currentMaster(), 'lookup-hmac')).update(value.trim().toLowerCase()).digest('hex');
}

/** Keyed hash of a client IP for rate limiting and audit, so raw IPs are never stored. */
export function ipHash(ip: string): string {
  return createHmac('sha256', deriveKey(currentMaster(), 'ip-hmac')).update(ip).digest('hex').slice(0, 32);
}

export function mockWebhookSecret(): string {
  return deriveKey(currentMaster(), 'mock-webhook').toString('base64url');
}

/** 256-bit random token, URL-safe. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Tokens are high-entropy, so a plain SHA-256 is enough to store them safely. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Still spend comparable time so length is not trivially observable.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

const ORDER_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Human-friendly order reference such as `K7Q2-M9XD`. Not a secret. */
export function orderNumber(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => ORDER_ALPHABET[b % ORDER_ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

/** Test hook: forget cached keys after env changes. */
export function resetKeyringForTests() {
  keyring = undefined;
}
