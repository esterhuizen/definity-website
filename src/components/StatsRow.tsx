// Static placeholder figures sourced narratively from the project's ethos.
// Drop in live numbers later via a /api/stats route if/when desired.

const STATS = [
  { label: 'Liquid staking token', value: 'definSOL' },
  { label: 'Custody model', value: 'Non-custodial' },
  { label: 'Unstake window', value: 'Anytime' },
  { label: 'Built on', value: 'SPL Stake Pool' },
];

export function StatsRow() {
  return (
    <section className="container-narrow -mt-10 relative z-10">
      <div className="surface grid grid-cols-2 divide-y divide-ring md:grid-cols-4 md:divide-y-0 md:divide-x">
        {STATS.map((s) => (
          <div key={s.label} className="px-6 py-5 text-center">
            <div className="font-display text-xl font-semibold text-ink md:text-2xl">{s.value}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-dim">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
