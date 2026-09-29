import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crypto Payment Store',
  description: 'Dark-themed crypto storefront placeholder.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
