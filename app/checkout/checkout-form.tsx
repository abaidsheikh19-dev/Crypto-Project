'use client';

import { useActionState } from 'react';
import { saveCheckoutDetails, type DetailsFormState } from './actions';
import { SubmitButton } from '@/src/components/submit-button';

type Field = { name: keyof NonNullable<DetailsFormState['values']>; label: string; autoComplete: string; type?: string; optional?: boolean; wide?: boolean };

const FIELDS: Field[] = [
  { name: 'email', label: 'Email for your confirmation', autoComplete: 'email', type: 'email', wide: true },
  { name: 'name', label: 'Full name', autoComplete: 'name', wide: true },
  { name: 'addressLine1', label: 'Address', autoComplete: 'address-line1', wide: true },
  { name: 'addressLine2', label: 'Apartment, suite, etc.', autoComplete: 'address-line2', optional: true, wide: true },
  { name: 'city', label: 'City', autoComplete: 'address-level2' },
  { name: 'region', label: 'State / region', autoComplete: 'address-level1', optional: true },
  { name: 'postcode', label: 'Postcode / ZIP', autoComplete: 'postal-code' },
];

export function CheckoutForm({ defaults, countries }: { defaults: DetailsFormState['values']; countries: readonly (readonly [string, string])[] }) {
  const [state, formAction] = useActionState(saveCheckoutDetails, { values: defaults });
  const values = state.values ?? {};
  const errors = state.errors ?? {};

  return (
    <form action={formAction} noValidate className="card-pad space-y-5">
      <h2 className="text-xl font-semibold text-white">Contact and shipping</h2>
      {errors.form ? <p role="alert" className="notice-error">{errors.form}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.name} className={field.wide ? 'md:col-span-2' : ''}>
            <label htmlFor={field.name} className="label">
              {field.label}
              {field.optional ? <span className="font-normal text-zinc-500"> (optional)</span> : null}
            </label>
            <input
              id={field.name}
              name={field.name}
              type={field.type ?? 'text'}
              autoComplete={field.autoComplete}
              defaultValue={values[field.name] ?? ''}
              required={!field.optional}
              aria-invalid={Boolean(errors[field.name])}
              aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
              className="input"
            />
            {errors[field.name] ? <p id={`${field.name}-error`} className="field-error">{errors[field.name]}</p> : null}
          </div>
        ))}
        <div>
          <label htmlFor="country" className="label">Country</label>
          <select
            id="country"
            name="country"
            autoComplete="country"
            defaultValue={values.country ?? 'US'}
            aria-invalid={Boolean(errors.country)}
            className="input"
          >
            {countries.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          {errors.country ? <p className="field-error">{errors.country}</p> : null}
        </div>
      </div>
      <p className="text-sm text-zinc-400">
        We only use these details to ship your order and send payment and shipping emails. They are encrypted and
        deleted automatically after the retention period.
      </p>
      <SubmitButton className="btn-primary w-full py-3 text-base" pendingText="Checking…">Review order</SubmitButton>
    </form>
  );
}
