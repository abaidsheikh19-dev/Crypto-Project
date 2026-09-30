import { describe, expect, it } from 'vitest';
import { centsToDollarsInput, parseDollarsToCents } from '../../src/lib/money';
import { base32Decode, base32Encode, generateRecoveryCodes, hotp, normalizeRecoveryCode, otpauthUri, totp, verifyTotp } from '../../src/lib/auth/totp';
import { centsToDecimalString } from '../../src/lib/payments/types';

describe('money parsing', () => {
  it('parses dollar strings to integer cents without floats', () => {
    expect(parseDollarsToCents('12')).toBe(1200);
    expect(parseDollarsToCents('12.5')).toBe(1250);
    expect(parseDollarsToCents('$1,234.56')).toBe(123456);
    expect(parseDollarsToCents('0.29')).toBe(29); // 0.29 * 100 is 28.999... in floating point
  });

  it('rejects anything that is not a plain amount', () => {
    for (const bad of ['', 'abc', '1.234', '-5', '1e3', '12.', ' . ']) expect(parseDollarsToCents(bad)).toBeNull();
  });

  it('formats cents for inputs and for the BTCPay API', () => {
    expect(centsToDollarsInput(1205)).toBe('12.05');
    expect(centsToDecimalString(7)).toBe('0.07');
    expect(centsToDecimalString(123456)).toBe('1234.56');
    expect(() => centsToDecimalString(1.5)).toThrow(RangeError);
  });
});

describe('TOTP (RFC 6238 / RFC 4226)', () => {
  const rfcSecret = Buffer.from('12345678901234567890');

  it('matches the RFC 4226 HOTP test vectors', () => {
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
    expected.forEach((code, counter) => expect(hotp(rfcSecret, counter)).toBe(code));
  });

  it('matches the RFC 6238 SHA-1 TOTP test vectors (8 digits)', () => {
    const cases: [number, string][] = [[59, '94287082'], [1111111109, '07081804'], [1234567890, '89005924'], [2000000000, '69279037']];
    for (const [seconds, code] of cases) expect(hotp(rfcSecret, Math.floor(seconds / 30), 8)).toBe(code);
  });

  it('round-trips base32', () => {
    const secret = base32Encode(rfcSecret);
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(secret).equals(rfcSecret)).toBe(true);
    expect(() => base32Decode('not base32!')).toThrow();
  });

  it('accepts one step of drift, rejects older codes and replays', () => {
    const secret = base32Encode(rfcSecret);
    const t = 1_700_000_000_000;
    const counter = Math.floor(t / 30_000);
    expect(verifyTotp(secret, totp(secret, t), { timeMs: t })).toBe(counter);
    expect(verifyTotp(secret, totp(secret, t - 30_000), { timeMs: t })).toBe(counter - 1);
    expect(verifyTotp(secret, totp(secret, t - 90_000), { timeMs: t })).toBeNull();
    expect(verifyTotp(secret, totp(secret, t), { timeMs: t, lastCounter: counter })).toBeNull();
    expect(verifyTotp(secret, '12345', { timeMs: t })).toBeNull();
  });

  it('builds an otpauth URI and unique recovery codes', () => {
    expect(otpauthUri('ABC', 'owner@example.com', 'Shop')).toBe('otpauth://totp/Shop%3Aowner%40example.com?secret=ABC&issuer=Shop&algorithm=SHA1&digits=6&period=30');
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
    expect(normalizeRecoveryCode(' AB12-cd34 ')).toBe('ab12cd34');
  });
});
