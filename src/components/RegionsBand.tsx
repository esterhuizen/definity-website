import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// A quieter, copy-led section that drives the regional narrative home before FAQ.
// Today's focus: APAC cities. EMEA expansion is on the near roadmap and shown as such.
const APAC_NOW = [
  'Singapore',
  'Hong Kong',
  'Tokyo',
  'Jakarta',
  'Manila',
  'Ho Chi Minh City',
  'Bangkok',
  'Kuala Lumpur',
  'Mumbai',
  'Karachi',
  'Dhaka',
];

const EMEA_SOON = ['Dubai', 'Abu Dhabi', 'Istanbul', 'Lagos', 'Nairobi'];

export function RegionsBand() {
  return (
    <section className="container-narrow py-24 md:py-32">
      <div className="surface relative overflow-hidden p-8 md:p-12">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sunrise-500/15 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-solana-500/10 blur-3xl" aria-hidden />

        <div className="relative grid gap-10 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7">
            <span className="eyebrow">The regions</span>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              Crypto's loudest stories happen elsewhere. Its most important ones happen here.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-muted text-pretty md:text-lg">
              In emerging markets, on-chain isn't a thought experiment — it's a remittance, a
              savings account, a side income. Definity sends a slice of every reward back to the
              builders making that real.
            </p>
            <Link
              href="/#mission"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-sunrise-400 hover:text-sunrise-300"
            >
              Read more about the mission <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="md:col-span-5">
            <ul className="flex flex-wrap gap-2">
              {APAC_NOW.map((city) => (
                <li
                  key={city}
                  className="rounded-full border border-ring bg-bg px-3 py-1 text-sm text-ink-muted"
                >
                  {city}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-ink-dim">
                Coming next
              </span>
              {EMEA_SOON.map((city) => (
                <span
                  key={city}
                  className="rounded-full border border-dashed border-solana-300 bg-solana-50/60 px-3 py-1 text-sm italic text-solana-700"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
