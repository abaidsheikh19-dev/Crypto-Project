export type Product = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  description: string;
  priceCents: number;
  stockQty: number;
  image: string;
  isActive: boolean;
};

export const products: Product[] = [
  {
    id: 'pen',
    slug: 'reusable-pen',
    name: 'Reusable Pen',
    sku: 'SKU-PEN-01',
    description: 'A smooth-writing stainless pen for daily carry and crypto gifting.',
    priceCents: 1500,
    stockQty: 12,
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
  },
  {
    id: 'refill',
    slug: 'ink-refill',
    name: 'Ink Refill',
    sku: 'SKU-INK-01',
    description: 'Replacement ink cartridge for the reusable pen.',
    priceCents: 800,
    stockQty: 20,
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
  },
  {
    id: 'notepad',
    slug: 'grid-notepad',
    name: 'Grid Notepad',
    sku: 'SKU-NOTE-01',
    description: 'Compact notepad for notes, addresses, and bitcoin wallet backups.',
    priceCents: 1200,
    stockQty: 8,
    image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
  },
  {
    id: 'wallet-case',
    slug: 'wallet-case',
    name: 'Wallet Case',
    sku: 'SKU-WAL-01',
    description: 'Slim wallet case fit for cards, notes, and a tiny keyring.',
    priceCents: 2200,
    stockQty: 0,
    image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
  },
  {
    id: 'usb-key',
    slug: 'usb-security-key',
    name: 'USB Security Key',
    sku: 'SKU-KEY-01',
    description: 'Portable hardware key for account security and private-key backups.',
    priceCents: 2800,
    stockQty: 5,
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
  },
  {
    id: 'travel-case',
    slug: 'travel-case',
    name: 'Travel Case',
    sku: 'SKU-CASE-01',
    description: 'Protection sleeve for the pen, cards, and a spare refill.',
    priceCents: 1700,
    stockQty: 14,
    image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
  },
  {
    id: 'sticker-pack',
    slug: 'crypto-sticker-pack',
    name: 'Crypto Sticker Pack',
    sku: 'SKU-STK-01',
    description: 'Small set of privacy-focused sticker designs for laptops and bottles.',
    priceCents: 900,
    stockQty: 17,
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
  },
  {
    id: 'journal',
    slug: 'ledger-journal',
    name: 'Ledger Journal',
    sku: 'SKU-JRN-01',
    description: 'Pocket journal for trade notes, records, and private planning.',
    priceCents: 1900,
    stockQty: 11,
    image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
  },
];

export function getProducts() {
  return products.filter((product) => product.isActive);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function formatPriceCents(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value / 100);
}
