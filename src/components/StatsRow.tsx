import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getGdiStanding } from '@/lib/gdi';

// Shape produced by scripts/fetch-pool-stats.mjs. Kept narrow on purpose:
// extra fields in the JSON are fine; we just don't read them here.
type PoolStats = {
  validators: number;
  totalSol: number;
  definsolSupply: number;
  exchangeRate: number | null;
  updatedAt: string;
};

async function readStats(): Promise<PoolStats | null> {
  try {
    const raw = await readFile(join(process.cwd(), 'public/stats.json'), 'utf8');
    return JSON.parse(raw) as PoolStats;
  } catch {
    // No stats.json yet (first deploy, or the timer hasn't fired). Fall back gracefully.
    return null;
  }
}

const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const solFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export async function StatsRow() {
  const [stats, gdi] = await Promise.all([readStats(), getGdiStanding()]);

  // Rigor leads: the independently-verified decentralisation rank is the
  // strongest tile, so it comes first. Raw pool size comes last.
  const tiles = [
    {
      value: gdi ? `#${gdi.rank} of ${gdi.total}` : 'Ranked',
      label: 'GDI decentralisation',
      live: true,
    },
    { value: 'Non-custodial', label: 'Custody', live: false },
    {
      value: stats ? intFmt.format(stats.validators) : '-',
      label: 'Validators',
      live: true,
    },
    {
      value: stats ? `${solFmt.format(stats.totalSol)} SOL` : '- SOL',
      label: 'TVL',
      live: true,
    },
  ];

  return (
    <section className="container-narrow -mt-10 relative z-10">
      <div className="surface grid grid-cols-2 divide-y divide-ring md:grid-cols-4 md:divide-y-0 md:divide-x">
        {tiles.map((t) => (
          <div key={t.label} className="px-6 py-5 text-center">
            <div className="font-display text-xl font-semibold text-ink md:text-2xl">
              {t.value}
            </div>
            <div className="mt-1 inline-flex items-center justify-center gap-1.5 text-xs uppercase tracking-[0.14em] text-ink-dim">
              {t.live && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-sunrise-500 animate-pulse-slow"
                  aria-hidden
                />
              )}
              {t.label}
            </div>
          </div>
        ))}
      </div>
      {stats && (
        <p className="mt-3 text-center text-[11px] text-ink-dim">
          On-chain stats refreshed{' '}
          <time dateTime={stats.updatedAt}>{relTime(stats.updatedAt)}</time>
        </p>
      )}
    </section>
  );
}

function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'just now';
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}
