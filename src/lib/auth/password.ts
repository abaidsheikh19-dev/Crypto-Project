import 'server-only';
import { createHash } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// OWASP-recommended Argon2id parameters (19 MiB, 2 iterations, 1 lane).
// @node-rs/argon2 uses Argon2id by default.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const MIN_PASSWORD_LENGTH = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

// Verified against when the account does not exist, so response time does not
// reveal whether an email is registered.
let dummyHash: Promise<string> | undefined;

export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  if (!passwordHash) {
    dummyHash ??= hashPassword('not-a-real-password-used-for-timing');
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  return verify(passwordHash, password).catch(() => false);
}

/**
 * Have I Been Pwned range check (k-anonymity: only the first five characters
 * of the SHA-1 hash leave the server). Fails open if the API is unreachable.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const suffix = sha1.slice(5);
    return (await response.text()).split('\n').some((line) => {
      const [candidate, count] = line.trim().split(':');
      return candidate === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
