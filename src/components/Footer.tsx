import Link from 'next/link';
import { Logo } from './Logo';
import { LINKS, POOL } from '@/config/pool';
import { TrackedLink } from './TrackedLink';

export function Footer() {
  return (
    <footer className="border-t border-ring bg-bg-muted/40">
      <div className="container-narrow grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-ink-muted text-pretty">
            A Solana stake pool on a mission: turn staking yield into real growth for the regions
            shaping Solana's next chapter.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-ink-dim">
            Product
          </h3>
          <ul className="space-y-2 text-sm">
            <li><Link className="text-ink-muted hover:text-ink" href="/#stake">Stake</Link></li>
            <li><Link className="text-ink-muted hover:text-ink" href="/#how">How it works</Link></li>
            <li><Link className="text-ink-muted hover:text-ink" href="/validators">Validators</Link></li>
            <li><Link className="text-ink-muted hover:text-ink" href="/institutions">Institutions</Link></li>
            <li><TrackedLink className="text-ink-muted hover:text-ink" href="/whitelist-apply" event="cta_whitelist_apply">Apply for whitelisting</TrackedLink></li>
            <li><Link className="text-ink-muted hover:text-ink" href="/addresses">Pool & token IDs</Link></li>
            <li><Link className="text-ink-muted hover:text-ink" href="/faq">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-ink-dim">
            Community
          </h3>
          <ul className="space-y-2 text-sm">
            <li><TrackedLink className="text-ink-muted hover:text-ink" href={LINKS.twitter} event="outbound_twitter" external>X</TrackedLink></li>
            <li><TrackedLink className="text-ink-muted hover:text-ink" href={LINKS.telegram} event="outbound_telegram" external>Telegram</TrackedLink></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ring">
        <div className="container-narrow flex flex-col gap-3 py-6 text-xs text-ink-dim md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Definity. {POOL.lstSymbol} is a liquid staking token on Solana.</p>
          <p className="font-mono">
            Pool: <span className="text-ink-muted">{POOL.stakePoolAddress.slice(0, 6)}…{POOL.stakePoolAddress.slice(-4)}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
