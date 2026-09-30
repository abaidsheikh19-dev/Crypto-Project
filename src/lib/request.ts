import 'server-only';
import { headers } from 'next/headers';
import { ipHash } from './crypto';

/** Best-effort client IP. Cloudflare and Vercel both overwrite these headers at the edge. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('cf-connecting-ip') ??
    h.get('x-real-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function clientIpHash(): Promise<string> {
  return ipHash(await clientIp());
}

/** Origin of the current request, used for same-deployment redirects. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
