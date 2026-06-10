import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type Validator = {
  vote: string;
  identity: string;
  name: string | null;
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  activatedStakeSol: number | null;
};

type ValidatorsData = {
  lastFetchedAt: string;
  expected: number;
  matched: number;
  countries: number;
  byCountry: Array<{ country: string; count: number }>;
  validators: Validator[];
  source: string;
};

async function readValidators(): Promise<ValidatorsData | null> {
  try {
    const raw = await readFile(join(process.cwd(), 'public/validators.json'), 'utf8');
    return JSON.parse(raw) as ValidatorsData;
  } catch {
    return null;
  }
}

// The world-map.svg ships with viewBox 0 0 950 620. We map lat/lng → x,y
// linearly against that frame. Wikipedia's "low resolution" map is *almost*
// equirectangular; the small residual distortion is invisible at the dot
// densities we render.
const MAP_W = 950;
const MAP_H = 620;
function project(lat: number, lng: number) {
  return {
    x: ((lng + 180) / 360) * MAP_W,
    y: ((90 - lat) / 180) * MAP_H,
  };
}

// Quick country-name → flag emoji. Covers the countries we actually see.
// If a new country shows up, the chip just renders without a flag.
const FLAG: Record<string, string> = {
  'Singapore': '🇸🇬',
  'Japan': '🇯🇵',
  'Hong Kong': '🇭🇰',
  'Brazil': '🇧🇷',
  'United States': '🇺🇸',
  'Germany': '🇩🇪',
  'Norway': '🇳🇴',
  'Netherlands': '🇳🇱',
  'United Kingdom': '🇬🇧',
  'France': '🇫🇷',
  'Canada': '🇨🇦',
  'Australia': '🇦🇺',
  'South Korea': '🇰🇷',
  'India': '🇮🇳',
  'Indonesia': '🇮🇩',
  'Switzerland': '🇨🇭',
  'Sweden': '🇸🇪',
  'Finland': '🇫🇮',
  'Ireland': '🇮🇪',
  'Lithuania': '🇱🇹',
  'Estonia': '🇪🇪',
  'Poland': '🇵🇱',
  'Ukraine': '🇺🇦',
  'Taiwan': '🇹🇼',
  'Mexico': '🇲🇽',
  'Argentina': '🇦🇷',
  'Chile': '🇨🇱',
  'South Africa': '🇿🇦',
  'Nigeria': '🇳🇬',
  'Kenya': '🇰🇪',
  'Russia': '🇷🇺',
  'Turkey': '🇹🇷',
  'United Arab Emirates': '🇦🇪',
  'Israel': '🇮🇱',
  'Vietnam': '🇻🇳',
  'Thailand': '🇹🇭',
  'Philippines': '🇵🇭',
  'Pakistan': '🇵🇰',
  'Bangladesh': '🇧🇩',
};

export async function ValidatorMap() {
  const data = await readValidators();
  if (!data || data.matched === 0) return null;

  const located = data.validators.filter(
    (v): v is Validator & { lat: number; lng: number } =>
      v.lat != null && v.lng != null && Number.isFinite(v.lat) && Number.isFinite(v.lng),
  );

  return (
    <section className="container-narrow py-20 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">Spread by design</span>
        <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {data.matched} validators,{' '}
          <span className="bg-sunrise-gradient bg-clip-text text-transparent">
            deliberately spread out
          </span>
          .
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink-muted text-pretty md:text-lg">
          Concentrated stake is correlated-failure risk. We delegate across rare countries,
          cities and network operators, and the spread is scored independently on the{' '}
          <a
            href="https://gdindex.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline decoration-ring underline-offset-2 hover:decoration-ink"
          >
            GDI
          </a>
          . This is a live snapshot of where those validators physically run.
        </p>
      </div>

      <div className="surface mt-10 overflow-hidden p-3 md:p-5">
        <div className="relative aspect-[950/620] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/world-map.svg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full select-none opacity-[0.18] [filter:saturate(0)_contrast(0.6)]"
          />
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={`World map showing ${located.length} validator locations`}
          >
            <defs>
              <radialGradient id="vm-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#14F195" stopOpacity="0.55" />
                <stop offset="60%" stopColor="#9945FF" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#9945FF" stopOpacity="0" />
              </radialGradient>
            </defs>
            {located.map((v, i) => {
              const { x, y } = project(v.lat, v.lng);
              return (
                <g key={`${v.vote}-${i}`}>
                  <title>
                    {v.name || v.vote.slice(0, 8)}
                    {v.city ? ` · ${v.city}` : ''}
                    {v.country ? `, ${v.country}` : ''}
                  </title>
                  <circle cx={x} cy={y} r={18} fill="url(#vm-glow)" />
                  <circle cx={x} cy={y} r={4} fill="#9945FF" />
                  <circle cx={x} cy={y} r={2} fill="#14F195" />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <ul className="mt-8 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {data.byCountry.map((c) => {
          const flag = FLAG[c.country];
          return (
            <li
              key={c.country}
              className="surface flex items-center justify-between px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm text-ink">
                {flag && <span aria-hidden="true">{flag}</span>}
                {c.country}
              </span>
              <span className="font-mono text-sm text-ink-muted">× {c.count}</span>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-center text-[11px] text-ink-dim">
        Data via{' '}
        <a
          href={`https://${data.source}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-ring underline-offset-2 hover:text-ink"
        >
          {data.source}
        </a>{' '}
        · refreshed daily ·{' '}
        {located.length} of {data.matched} located, {data.matched - located.length} unknown
      </p>
    </section>
  );
}
