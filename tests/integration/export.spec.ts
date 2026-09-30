import { beforeEach, describe, expect, it } from 'vitest';
import { Decrypter, generateIdentity, identityToRecipient } from 'age-encryption';
import { db } from '../../src/lib/db';
import { placeOrder } from '../../src/lib/orders';
import { encryptExport, loadExportRows, toCsv, toJson } from '../../src/server/export';
import { details, makeCart, makeProduct, resetDb } from '../support/factories';

describe('encrypted export', () => {
  beforeEach(resetDb);

  it('produces an age file that decrypts with the passphrase, and only with it', async () => {
    const product = await makeProduct();
    await placeOrder({ cartId: (await makeCart([{ productId: product.id, qty: 1 }])).id, details, origin: 'https://shop.test' });
    const rows = await loadExportRows(new Date(Date.now() - 86_400_000), new Date(Date.now() + 86_400_000));
    const csv = toCsv(rows);
    expect(csv).toContain('alice@example.com');

    const file = await encryptExport(csv, { passphrase: 'correct horse battery staple' });
    expect(Buffer.from(file).toString('utf8')).not.toContain('alice');

    const right = new Decrypter();
    right.addPassphrase('correct horse battery staple');
    expect(new TextDecoder().decode(await right.decrypt(file))).toBe(csv);

    const wrong = new Decrypter();
    wrong.addPassphrase('wrong passphrase entirely');
    await expect(wrong.decrypt(file)).rejects.toThrow();
  });

  it('supports an age public key instead of a passphrase', async () => {
    const identity = await generateIdentity();
    const json = toJson([]);
    const file = await encryptExport(json, { recipient: await identityToRecipient(identity) });
    const decrypter = new Decrypter();
    decrypter.addIdentity(identity);
    expect(new TextDecoder().decode(await decrypter.decrypt(file))).toBe(json);
  });

  it('neutralises spreadsheet formula injection in CSV cells', async () => {
    const product = await makeProduct();
    await placeOrder({
      cartId: (await makeCart([{ productId: product.id, qty: 1 }])).id,
      details: { ...details, name: '=HYPERLINK("http://evil.test","x")' },
      origin: 'https://shop.test',
    });
    const csv = toCsv(await loadExportRows(new Date(0), new Date(Date.now() + 86_400_000)));
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.test"",""x"")"`);
    expect(await db.order.count()).toBe(1);
  });
});
