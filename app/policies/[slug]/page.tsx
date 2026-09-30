import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StoreShell } from '@/src/components/store-shell';
import { getSettings } from '@/src/lib/settings';
import { env } from '@/src/lib/env';

// Placeholder copy for the client to replace before launch.
function policies(retentionDays: number, contact: string): Record<string, { title: string; body: string[] }> {
  return {
    terms: {
      title: 'Terms of Sale',
      body: [
        'Placeholder terms - replace with your own before launch.',
        'Prices are in US dollars. Payment is made in cryptocurrency at the exchange rate shown on the invoice when you pay.',
        'An order is confirmed once the payment is confirmed on the network.',
      ],
    },
    shipping: {
      title: 'Shipping Policy',
      body: [
        'Placeholder shipping policy - replace with your own before launch.',
        'Orders are packed and shipped by us after payment is confirmed. You will get an email with tracking details when your order ships.',
      ],
    },
    refund: {
      title: 'Refund Policy',
      body: [
        'Placeholder refund policy - replace with your own before launch.',
        `Refunds are handled manually. Contact ${contact} with your order number.`,
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      body: [
        'Placeholder privacy policy - replace with your own before launch.',
        'We collect only what we need to ship your order: your name, shipping address and email address. These are encrypted when stored.',
        `We automatically delete your personal details ${retentionDays} days after your order is completed. Anonymous order totals are kept for stock and sales records.`,
        'We do not use analytics, advertising trackers or third-party cookies. The only cookies we set are the ones needed for your cart.',
        'Payments are processed by our own self-hosted BTCPay Server. It receives only an order reference, never your name, email or address.',
      ],
    },
  };
}

function findPolicy(all: ReturnType<typeof policies>, slug: string) {
  return Object.hasOwn(all, slug) ? all[slug] : null;
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = findPolicy(policies(30, ''), (await params).slug);
  return { title: page?.title ?? 'Not found' };
}

export default async function PolicyPage({ params }: Props) {
  const settings = await getSettings();
  const page = findPolicy(policies(settings.retention_days, env().CONTACT_EMAIL), (await params).slug);
  if (!page) notFound();

  return (
    <StoreShell>
      <article className="card-pad mx-auto max-w-3xl">
        <Link href="/" className="link text-sm">← Back to shop</Link>
        <h1 className="mt-6 text-3xl font-bold text-white">{page.title}</h1>
        <div className="mt-6 space-y-4 leading-7 text-zinc-300">
          {page.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>
    </StoreShell>
  );
}
