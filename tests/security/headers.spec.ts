import { describe, it, expect } from 'vitest';
import { buildSecurityHeaders } from '../../src/lib/security/headers';

describe('security headers', () => {
  it('includes a hardened HSTS policy and no-framing rule', () => {
    const headers = buildSecurityHeaders();

    expect(headers['strict-transport-security']).toContain('max-age=63072000');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-frame-options']).toBe('DENY');
  });

  it('allows remote product images from Unsplash', () => {
    const headers = buildSecurityHeaders();

    expect(headers['content-security-policy']).toContain("img-src 'self' data: https://images.unsplash.com");
  });
});
