import 'server-only';
import { decrypt } from './crypto';
import { checkoutDetailsSchema, type CheckoutDetails } from './validators';

export function readCheckoutDraft(draftEnc: string | null): CheckoutDetails | null {
  if (!draftEnc) return null;
  try {
    const parsed = checkoutDetailsSchema.safeParse(JSON.parse(decrypt(draftEnc)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
