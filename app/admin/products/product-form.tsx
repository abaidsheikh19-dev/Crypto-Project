'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/src/components/submit-button';
import type { ProductFormState } from './actions';

export type ProductDefaults = {
  id?: number;
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: string;
  stockQty?: number;
  lowStockThreshold: number;
  sortOrder: number;
  isActive: boolean;
  isRestricted: boolean;
};

export function ProductForm({ action, defaults, submitLabel }: { action: (state: ProductFormState, data: FormData) => Promise<ProductFormState>; defaults: ProductDefaults; submitLabel: string }) {
  const [state, formAction] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  const field = (name: keyof ProductDefaults, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} defaultValue={String(defaults[name] ?? '')} className="input" aria-invalid={Boolean(errors[name])} {...props} />
      {errors[name] ? <p className="field-error">{errors[name]}</p> : null}
    </div>
  );

  return (
    <form action={formAction} className="card-pad space-y-4">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {state.error ? <p role="alert" className="notice-error">{state.error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {field('name', 'Name', { required: true, maxLength: 120 })}
        {field('sku', 'SKU', { required: true, maxLength: 40 })}
        {field('slug', 'URL slug (leave blank to generate)', { maxLength: 80 })}
        {field('price', 'Price (USD)', { required: true, inputMode: 'decimal', placeholder: '12.50' })}
        {defaults.id ? null : field('stockQty', 'Starting stock', { type: 'number', min: 0 })}
        {field('lowStockThreshold', 'Low-stock alert at', { type: 'number', min: 0 })}
        {field('sortOrder', 'Sort order (lower shows first)', { type: 'number' })}
      </div>
      <div>
        <label htmlFor="description" className="label">Description (plain text)</label>
        <textarea id="description" name="description" defaultValue={defaults.description} rows={5} maxLength={4000} className="input" />
      </div>
      <div className="flex flex-wrap gap-6 text-sm text-zinc-200">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={defaults.isActive} className="h-4 w-4 accent-emerald-500" /> Active (shown in the shop)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isRestricted" defaultChecked={defaults.isRestricted} className="h-4 w-4 accent-emerald-500" /> Restricted
          <span className="text-zinc-500">(reserved for future notices - no effect yet)</span>
        </label>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
