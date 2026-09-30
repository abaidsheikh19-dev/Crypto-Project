/**
 * Security headers applied by middleware.ts to every response. Pure so it can
 * run in the Edge runtime and be unit-tested.
 */

export function buildCsp(options: { nonce: string; dev: boolean; paymentOrigin?: string | null }): string {
  const formAction = ["'self'", options.paymentOrigin].filter(Boolean).join(' ');
  const directives: Record<string, string> = {
    'default-src': "'self'",
    // Next.js inline bootstrap scripts carry this per-request nonce; anything
    // they load is trusted through 'strict-dynamic'. No 'unsafe-inline'.
    'script-src': `'self' 'nonce-${options.nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ''}`,
    'style-src': options.dev ? "'self' 'unsafe-inline'" : "'self'",
    'img-src': "'self' data:",
    'font-src': "'self'",
    'connect-src': options.dev ? "'self' ws:" : "'self'",
    'object-src': "'none'",
    'base-uri': "'none'",
    'form-action': formAction,
    'frame-ancestors': "'none'",
    'frame-src': "'none'",
    'worker-src': "'self'",
    'manifest-src': "'self'",
  };
  const policy = Object.entries(directives).map(([name, value]) => `${name} ${value}`);
  if (!options.dev) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

export function securityHeaders(options: { nonce: string; dev: boolean; paymentOrigin?: string | null }): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': buildCsp(options),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-DNS-Prefetch-Control': 'off',
  };
  if (!options.dev) headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  return headers;
}

export function originOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
