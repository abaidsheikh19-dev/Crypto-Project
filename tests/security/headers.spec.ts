import { describe, expect, it } from 'vitest';
import { buildCsp, originOf, securityHeaders } from '../../src/lib/security/headers';

describe('security headers', () => {
  const prod = securityHeaders({ nonce: 'abc123', dev: false });

  it('sets HSTS, nosniff, referrer, framing and permissions policies in production', () => {
    expect(prod['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(prod['X-Content-Type-Options']).toBe('nosniff');
    expect(prod['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(prod['X-Frame-Options']).toBe('DENY');
    expect(prod['Permissions-Policy']).toContain('camera=()');
  });

  it('uses a per-request nonce and never unsafe-inline or unsafe-eval for scripts in production', () => {
    const csp = prod['Content-Security-Policy'];
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('allows no third-party origins except the configured payment server for form redirects', () => {
    const csp = buildCsp({ nonce: 'n', dev: false, paymentOrigin: 'https://pay.example.com' });
    expect(csp).toContain("form-action 'self' https://pay.example.com");
    expect(csp.match(/https:\/\//g)).toHaveLength(1);
  });

  it('parses payment origins defensively', () => {
    expect(originOf('https://pay.example.com/some/path')).toBe('https://pay.example.com');
    expect(originOf('not a url')).toBeNull();
    expect(originOf(undefined)).toBeNull();
  });
});
