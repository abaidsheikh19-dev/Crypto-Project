import './globals.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { STORE_NAME } from '@/src/lib/brand';

export const metadata: Metadata = {
  title: { default: STORE_NAME, template: `%s · ${STORE_NAME}` },
  description: 'Privacy-first accessories, paid in Bitcoin and other cryptocurrencies.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#050b08', colorScheme: 'dark' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers makes every page render per request, which is what lets
  // Next.js attach the CSP nonce from middleware to its scripts.
  await headers();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
