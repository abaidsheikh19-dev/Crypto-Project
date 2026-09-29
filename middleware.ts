import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const csp = [
  "default-src 'self'",
  "img-src 'self' data: https://images.unsplash.com",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'nonce-__NEXT_NONCE__'",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests"
].join('; ');

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-Frame-Options', 'DENY');

  return response;
}

export const config = {
  matcher: ['/((?!api/health).*)']
};
