import { formatCents } from '@/src/lib/pricing';

export function Price({ priceCents, saleCents, size = 'md', badge = true }: { priceCents: number; saleCents?: number; size?: 'md' | 'lg'; badge?: boolean }) {
  const onSale = saleCents !== undefined && saleCents < priceCents;
  const main = size === 'lg' ? 'text-3xl' : 'text-xl';
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`${main} font-bold text-emerald-300`}>{formatCents(onSale ? saleCents! : priceCents)}</span>
      {onSale ? (
        <>
          <s className="text-sm text-zinc-500"><span className="sr-only">Was </span>{formatCents(priceCents)}</s>
          {badge ? <span className="pill border-emerald-400/40 bg-emerald-400/10 text-emerald-200">Sale</span> : null}
        </>
      ) : null}
    </span>
  );
}
