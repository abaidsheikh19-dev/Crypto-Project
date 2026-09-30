// Idempotent seed: creates demo catalogue data only when the tables are empty,
// and the first Owner admin only when no admin exists. Safe to run on every
// deploy - it never overwrites the client's edits.
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const db = new PrismaClient();

const PRODUCTS = [
  ['reusable-pen', 'SKU-PEN-01', 'Reusable Pen', 'A weighted stainless pen for daily carry. Refillable, so it lasts for years.', 1500, 12, 'pen'],
  ['ink-refill', 'SKU-INK-01', 'Ink Refill (2-pack)', 'Replacement cartridges for the Reusable Pen. Smooth black gel ink.', 800, 20, 'refill'],
  ['grid-notepad', 'SKU-NOTE-01', 'Grid Notepad', 'Compact dot-grid notepad with acid-free paper - good for notes and offline backups.', 1200, 8, 'notepad'],
  ['wallet-case', 'SKU-WAL-01', 'Slim Wallet Case', 'Slim case for cards, cash and a small keyring. RFID-blocking lining.', 2200, 0, 'wallet'],
  ['usb-security-key', 'SKU-KEY-01', 'USB Security Key', 'Hardware key for two-factor sign-in on the accounts that matter most.', 2800, 3, 'key'],
  ['travel-case', 'SKU-CASE-01', 'Travel Case', 'Zip case that holds the pen, a spare refill and a notepad.', 1700, 14, 'case'],
  ['sticker-pack', 'SKU-STK-01', 'Sticker Pack', 'Five matte vinyl stickers for laptops and bottles.', 900, 17, 'stickers'],
  ['ledger-journal', 'SKU-JRN-01', 'Ledger Journal', 'Hard-cover pocket journal with numbered pages for records and planning.', 1900, 11, 'journal'],
];

async function seedCatalogue() {
  if ((await db.product.count()) > 0) return console.log('seed: products exist, skipping catalogue');
  for (const [index, [slug, sku, name, description, priceCents, stockQty, image]] of PRODUCTS.entries()) {
    await db.product.create({
      data: {
        slug, sku, name, description, priceCents, stockQty, sortOrder: index,
        images: { create: [{ fileKey: `images/products/${image}.svg`, altText: `${name} (placeholder image)` }] },
      },
    });
  }
  const journal = await db.product.findUniqueOrThrow({ where: { slug: 'ledger-journal' } });
  await db.promotion.create({ data: { productId: journal.id, type: 'PERCENT', value: 20 } });
  await db.discountCode.createMany({
    data: [
      { codeNormalized: 'WELCOME10', type: 'PERCENT', value: 10 },
      { codeNormalized: 'SAVE5', type: 'FIXED', value: 500, minOrderCents: 3000, maxUses: 100 },
    ],
  });
  console.log(`seed: created ${PRODUCTS.length} products, 1 sale and 2 discount codes`);
}

async function seedOwner() {
  if ((await db.adminUser.count()) > 0) return console.log('seed: admin exists, skipping owner');
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return console.log('seed: set ADMIN_EMAIL and ADMIN_PASSWORD to create the first owner');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  await db.adminUser.create({
    data: {
      email,
      role: 'OWNER',
      passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      recoveryCodeHashes: [],
    },
  });
  console.log('seed: created owner admin (two-factor setup happens on first sign-in)');
}

try {
  await seedCatalogue();
  await seedOwner();
} finally {
  await db.$disconnect();
}
