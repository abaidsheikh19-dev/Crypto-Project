import { createHmac, randomBytes } from 'node:crypto';

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s steps) as used by authenticator apps. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number, digits = 6, algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac(algorithm, secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(binary).padStart(digits, '0');
}

export const counterAt = (timeMs: number) => Math.floor(timeMs / 1000 / STEP_SECONDS);

export function totp(secretBase32: string, timeMs = Date.now()): string {
  return hotp(base32Decode(secretBase32), counterAt(timeMs));
}

/**
 * Returns the matching time-step counter (so callers can reject reuse), or
 * null. Accepts one step of clock drift either way.
 */
export function verifyTotp(secretBase32: string, code: string, options: { timeMs?: number; lastCounter?: number | null } = {}): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = counterAt(options.timeMs ?? Date.now());
  for (const counter of [current - 1, current, current + 1]) {
    if (options.lastCounter != null && counter <= options.lastCounter) continue;
    if (hotp(secret, counter) === code) return counter;
  }
  return null;
}

export function otpauthUri(secretBase32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: 'SHA1', digits: '6', period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Ten single-use recovery codes like `k3f9-2m7q-x8d4`. */
export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(12);
    const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
  });
}

export const normalizeRecoveryCode = (code: string) => code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
