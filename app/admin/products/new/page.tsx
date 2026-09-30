import type { Metadata } from 'next';
import { AdminShell } from '@/src/components/admin-shell';
import { requireAdmin } from '@/src/lib/auth/admin-session';
import { ProductForm } from '../product-form';
import { createProduct } from '../actions';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  const context = await requireAdmin();
  return (
    <AdminShell context={context} title="New product">
      <ProductForm
        action={createProduct}
        submitLabel="Create product"
        defaults={{ name: '', slug: '', sku: '', description: '', price: '', stockQty: 0, lowStockThreshold: 3, sortOrder: 0, isActive: true, isRestricted: false }}
      />
      <p className="mt-4 text-sm text-zinc-500">New products start with a placeholder image. Photo upload arrives with the VPS deployment, where uploads can be stored privately.</p>
    </AdminShell>
  );
}
