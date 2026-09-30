'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ children, className = 'btn-primary', pendingText, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} type="submit" className={className} disabled={pending || rest.disabled} aria-disabled={pending}>
      {pending ? (pendingText ?? 'Working…') : children}
    </button>
  );
}
