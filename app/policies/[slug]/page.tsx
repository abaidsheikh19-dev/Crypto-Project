import Link from 'next/link';
import { notFound } from 'next/navigation';

const policyCopy: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of Sale',
    body: [
      'These placeholder terms are included for future client editing.',
      'Orders are final after payment confirmation unless a manual refund is approved.',
      'The retailer ships products directly from their own stock and manages order fulfilment outside the website.',
    ],
  },
  shipping: {
    title: 'Shipping Policy',
    body: [
      'Shipping is handled outside the storefront using the client’s preferred carrier workflow.',
      'Customers receive shipping details directly from the seller after order confirmation.',
    ],
  },
  refund: {
    title: 'Refund Policy',
    body: [
      'Refunds are reviewed manually and may require proof of delivery or a dispute review.',
      'Cryptocurrency refunds depend on the client’s policy and the bitcoin conversion rate at the time of refund.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      'This prototype keeps the privacy posture aligned with the project specification and retains personal data only within the configured retention window.',
      'The client can configure the retention window and the system removes personal data from eligible completed orders after that period.',
    ],
  },
};

export default function PolicyPage({ params }: { params: { slug: string } }) {
  const current = policyCopy[params.slug];

  if (!current) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl rounded-xl border border-emerald-500/20 bg-ink-900 px-8 py-10">
        <Link href="/catalog" className="text-sm text-emerald-300">← Back to store</Link>
        <h1 className="mt-6 text-3xl font-bold text-white">{current.title}</h1>
        <div className="mt-6 space-y-4 text-zinc-300">
          {current.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </main>
  );
}
