// Superseded: the storefront now uses server actions (app/checkout/actions.ts),
// which get Next.js's built-in Origin check. This old endpoint is kept only so
// stale forms land somewhere sensible. Safe to delete.
export function POST() {
  return new Response(null, { status: 303, headers: { Location: '/checkout' } });
}
