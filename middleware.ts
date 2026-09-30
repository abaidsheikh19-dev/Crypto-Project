import { NextResponse, type NextRequest } from 'next/server';
import { originOf, securityHeaders } from './src/lib/security/headers';

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const headers = securityHeaders({
    nonce,
    dev: process.env.NODE_ENV === 'development',
    paymentOrigin: originOf(process.env.BTCPAY_URL),
  });

  // Next.js reads the nonce from the request's CSP header and adds it to the
  // scripts it renders.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', headers['Content-Security-Policy']);

  // Cheap early exit for admin pages without a session cookie. The real
  // authorisation check (session + MFA + role) runs in every page and action.
  const { pathname } = request.nextUrl;
  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminPublic = pathname === '/admin/login';
  const hasAdminCookie = request.cookies.has('__Host-admin_session') || request.cookies.has('admin_session');

  const response =
    isAdminArea && !isAdminPublic && !hasAdminCookie
      ? NextResponse.redirect(new URL('/admin/login', request.url), 303)
      : NextResponse.next({ request: { headers: requestHeaders } });

  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)' }],
};
