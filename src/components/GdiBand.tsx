import { ShieldCheck, ArrowUpRight } from 'lucide-react';
import { getGdiStanding, GDI_URLS } from '@/lib/gdi';

// Homepage credibility strip: surfaces definSOL's live, independently-verifiable
// GDI rank, the single strongest decentralisation proof point, and one the
// retail homepage otherwise never mentions.
export async function GdiBand() {
  const g = await getGdiStanding();
  return (
    <section className="container-narrow mt-8">
      <a
        href={g ? GDI_URLS.pool : GDI_URLS.index}
        target="_blank"
        rel="noreferrer"
        className="surface group flex flex-col items-start gap-3 p-5 transition hover:border-sunrise-500/40 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-muted ring-1 ring-ring">
            <ShieldCheck className="h-4 w-4 text-sunrise-500" aria-hidden="true" />
          </span>
          <p className="text-sm leading-relaxed text-ink-muted text-pretty">
            <span className="font-semibold text-ink">Independently verified.</span>{' '}
            {g ? (
              <>
                definSOL ranks{' '}
                <span className="font-semibold text-ink">#{g.rank} of {g.total}</span>{' '}
                Solana stake pools on the GDI, the open geographic-decentralisation index,
                {g.baseline ? (
                  <> scoring {g.gdi.toFixed(2)} against a {g.baseline.toFixed(2)} network baseline.</>
                ) : (
                  <> scored from public on-chain data.</>
                )}
              </>
            ) : (
              <>
                definSOL is independently ranked on the GDI, the open
                geographic-decentralisation index for Solana stake pools, reproducible from
                public data.
              </>
            )}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-sunrise-500 group-hover:underline">
          Reproduce our score <ArrowUpRight className="h-4 w-4" />
        </span>
      </a>
    </section>
  );
}
