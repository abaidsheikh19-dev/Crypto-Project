'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/src/components/submit-button';
import { enrollMfaAction, loginAction, verifyMfaAction, type AuthFormState } from './auth-actions';

function ErrorNotice({ state }: { state: AuthFormState }) {
  return state.error ? <p role="alert" className="notice-error">{state.error}</p> : null;
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <ErrorNotice state={state} />
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Checking…">Continue</SubmitButton>
    </form>
  );
}

export function MfaForm() {
  const [state, action] = useActionState(verifyMfaAction, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <ErrorNotice state={state} />
      <div>
        <label htmlFor="code" className="label">6-digit code or a recovery code</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus className="input text-center font-mono text-lg tracking-[0.3em]" />
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Verifying…">Verify</SubmitButton>
    </form>
  );
}

export function EnrolForm() {
  const [state, action] = useActionState(enrollMfaAction, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <ErrorNotice state={state} />
      <div>
        <label htmlFor="code" className="label">Enter the 6-digit code from the app</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required className="input text-center font-mono text-lg tracking-[0.3em]" />
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Verifying…">Turn on two-factor authentication</SubmitButton>
    </form>
  );
}
