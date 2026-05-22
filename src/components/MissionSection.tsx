import { Heart, Globe2, Sprout } from 'lucide-react';

const PILLARS = [
  {
    icon: Globe2,
    title: 'Where Solana grows next',
    body:
      'Most of the world hasn\'t met Solana yet. Across APAC, the Middle East, Africa, and South America, builders are launching real products — payments, identity, on-chain savings — for users who actually need them. Definity exists to fund that wave.',
  },
  {
    icon: Sprout,
    title: 'Yield with a destination',
    body:
      'Every epoch, the validators we delegate to pay out staking rewards. A portion of pool fees is reinvested directly into developer programs, hackathons, and early-stage support for teams in those regions. Your SOL keeps earning. Their work keeps shipping.',
  },
  {
    icon: Heart,
    title: 'Aligned with the people who use it',
    body:
      'You stay in control of your capital. You can swap definSOL back to SOL the moment you want to. Mission-aligned doesn\'t mean concessional — it means the upside compounds for everyone holding the token.',
  },
];

export function MissionSection() {
  return (
    <section id="mission" className="container-narrow scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">Why Definity</span>
        <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
          Staking is already passive income. We made it{' '}
          <span className="bg-sunrise-gradient bg-clip-text text-transparent">purposeful</span>.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-ink-muted text-pretty">
          Choosing where you stake is the simplest economic vote you can cast on what Solana
          becomes next. Definity points that vote at the regions doing the most with the least.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <article
            key={title}
            className="surface relative overflow-hidden p-7 transition hover:border-sunrise-500/40"
          >
            <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-bg-muted ring-1 ring-ring">
              <Icon className="h-5 w-5 text-sunrise-400" aria-hidden="true" />
            </div>
            <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted text-pretty">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
