import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowUpRight, ArrowRight, ShieldCheck, Lock, Eye,
  Gauge, Cpu, Activity, ScrollText, KeyRound,
} from 'lucide-react';
import { POOL, LINKS } from '@/config/pool';
import { getGdiStanding, GDI_URLS } from '@/lib/gdi';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Institutions',
  description:
    'definSOL for institutions: non-custodial liquid staked SOL with independently-verifiable decentralisation. Self-custody, audited Sanctum program, transparent on-chain, GDI-ranked. Talk to our team.',
};

const THRESHOLDS = [
  { icon: Gauge, title: 'Validator commission ≤ 5%', body: 'On-chain commission from Solana RPC cannot exceed 5%. Above it, the validator is rejected from the set.' },
  { icon: Activity, title: 'MEV commission ≤ 10%', body: 'Jito MEV commission capped at 1000 bps so MEV rewards flow to stakers, not operators.' },
  { icon: Cpu, title: 'Actively voting, low skip rate', body: 'Live on mainnet, never persistently delinquent, skip rate held below 10% across recent epochs, stricter than the Foundation Delegation Program baseline.' },
  { icon: ShieldCheck, title: 'SFDP standing intact', body: 'Must not have been removed from the Solana Foundation Delegation Program for cause.' },
];

export default async function InstitutionsPage() {
  const g = await getGdiStanding();
  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;
  const aboveBaseline =
    g && g.baseline ? Math.round(((g.gdi - g.baseline) / g.baseline) * 100) : null;

  return (
    <div className="pb-24">
      {/* Hero: restrained, no gradient wash, no sparkle. Proof-led. */}
      <section className="border-b border-ring">
        <div className="container-narrow py-20 md:py-28">
          <span className="eyebrow">For institutions</span>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            Non-custodial staked SOL, with decentralisation you can verify.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted text-pretty">
            definSOL is liquid staked SOL built on Sanctum&apos;s audited stake-pool program.
            You self-custody the token and exit permissionlessly, and every claim we make about
            decentralisation, validator quality, and reserves is verifiable on-chain or
            recomputable from public data. No custody of your funds. No black box.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href={LINKS.telegram}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Talk to our team <ArrowUpRight className="h-4 w-4" />
            </a>
            <Link href="/addresses" className="btn-ghost">
              Verify on-chain <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <section className="border-b border-ring bg-bg-muted/40">
        <div className="container-narrow grid grid-cols-2 gap-px md:grid-cols-4">
          {[
            { k: 'Custody', v: 'Non-custodial', sub: 'You hold the token' },
            { k: 'Program', v: 'Audited', sub: 'Sanctum stake-pool' },
            { k: 'Decentralisation', v: g ? `GDI #${g.rank}/${g.total}` : 'GDI-ranked', sub: 'Independently verified' },
            { k: 'Transparency', v: 'Reproducible', sub: '100% public on-chain data' },
          ].map((t) => (
            <div key={t.k} className="px-2 py-7 text-center">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-dim">{t.k}</div>
              <div className="mt-2 font-display text-xl font-semibold text-ink md:text-2xl">{t.v}</div>
              <div className="mt-1 text-xs text-ink-muted">{t.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GDI centrepiece: the differentiator */}
      <section className="container-narrow py-20 md:py-28">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <span className="eyebrow">Decentralisation as risk management</span>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              Measured, not asserted.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-muted text-pretty md:text-lg">
              Concentrated stake, whether by geography, network operator, or client, is a
              correlated-failure risk. definSOL deliberately delegates across rare countries, cities,
              and ASNs, and the
              result is scored by the <span className="font-medium text-ink">GDI</span>, an open
              decentralisation index for Solana stake pools. It is not our number: it is computed
              from public on-chain data and{' '}
              <a className="text-ink underline underline-offset-2" href={GDI_URLS.repo} target="_blank" rel="noreferrer">
                reproducible in one command
              </a>{' '}
              by anyone, including you.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <a className="inline-flex items-center gap-1 font-medium text-sunrise-500 hover:underline" href={g ? GDI_URLS.pool : GDI_URLS.index} target="_blank" rel="noreferrer">
                See definSOL on the index <ArrowUpRight className="h-4 w-4" />
              </a>
              <a className="inline-flex items-center gap-1 font-medium text-ink-muted hover:text-ink" href={GDI_URLS.methodology} target="_blank" rel="noreferrer">
                Methodology <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="surface p-8">
            <div className="text-xs uppercase tracking-[0.18em] text-ink-dim">definSOL on the GDI</div>
            <div className="mt-3 flex items-end gap-3">
              <span className="font-display text-6xl font-semibold tracking-tight text-ink">
                {g ? `#${g.rank}` : '-'}
              </span>
              <span className="pb-2 text-lg text-ink-muted">of {g ? g.total : '-'} pools</span>
            </div>
            {g ? (
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-ink-dim">GDI score</dt>
                  <dd className="mt-1 font-display text-xl font-semibold text-ink tabular-nums">{g.gdi.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-ink-dim">Network baseline</dt>
                  <dd className="mt-1 font-display text-xl font-semibold text-ink tabular-nums">{g.baseline ? g.baseline.toFixed(2) : '-'}</dd>
                </div>
              </dl>
            ) : null}
            {aboveBaseline != null ? (
              <p className="mt-5 flex items-center gap-1.5 text-sm text-success">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {aboveBaseline}% above the network-wide average decentralisation.
              </p>
            ) : null}
            <p className="mt-5 border-t border-ring pt-4 text-xs text-ink-dim">
              Live figure, recomputed each epoch from{' '}
              <span className="font-mono">gdindex.app</span>. The Solana Foundation is engaging
              with the GDI as a decentralisation standard.
            </p>
          </div>
        </div>
      </section>

      {/* Validator selection rigor */}
      <section className="border-y border-ring bg-bg-muted/40">
        <div className="container-narrow py-20 md:py-28">
          <div className="max-w-2xl">
            <span className="eyebrow">Validator selection</span>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              Hard thresholds, enforced every epoch.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-muted text-pretty md:text-lg">
              Stake is delegated only to validators that clear an explicit eligibility bar, and it is
              re-checked after every epoch. Breach a threshold and a validator drops from the
              active set.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {THRESHOLDS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="surface p-6">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-bg-muted ring-1 ring-ring">
                  <Icon className="h-4 w-4 text-sunrise-500" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted text-pretty">{body}</p>
              </div>
            ))}
          </div>
          <Link href="/validators" className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-sunrise-500 hover:underline">
            See the full selection policy and live delegation set <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Non-custodial + transparency */}
      <section className="container-narrow py-20 md:py-28">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Lock, title: 'You hold the keys', body: 'definSOL is self-custodied. You mint and redeem permissionlessly via Jupiter or Sanctum; Definity’s program cannot move user funds, which Solana enforces on-chain. It holds in your own custody stack like any SPL token.' },
            { icon: KeyRound, title: 'Liquid, exit anytime', body: 'Swap definSOL back to SOL in seconds through Sanctum’s router and instant-unstake reserve, or withdraw from the pool directly. No lockups, no epoch wait for the liquid path.' },
            { icon: Eye, title: 'Verify, don’t trust', body: 'Pool account, validator list, fees and reserve are all public on-chain, and the decentralisation score is reproducible from public data. The audited program is Sanctum’s, a battle-tested fork of Solana’s SPL Stake Pool.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="surface p-7">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-bg-muted ring-1 ring-ring">
                <Icon className="h-5 w-5 text-sunrise-500" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted text-pretty">{body}</p>
            </article>
          ))}
        </div>

        {/* Canonical addresses, inline */}
        <div className="surface mt-6 divide-y divide-ring">
          {[
            { label: 'Definity stake pool', addr: POOL.stakePoolAddress, href: LINKS.solscanPool },
            { label: 'definSOL mint', addr: POOL.lstMint, href: LINKS.solscanMint },
          ].map((row) => (
            <div key={row.addr} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-dim">{row.label}</div>
                <div className="mt-1 font-mono text-sm text-ink">{short(row.addr)}</div>
              </div>
              <a href={row.href} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
                Solscan <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-narrow">
        <div className="surface relative overflow-hidden p-10 text-center md:p-16">
          <div className="absolute inset-0 bg-dawn-gradient opacity-40" aria-hidden="true" />
          <div className="relative mx-auto max-w-2xl">
            <ScrollText className="mx-auto h-6 w-6 text-sunrise-500" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              Allocating size? Let&apos;s talk specifics.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-muted text-pretty md:text-lg">
              Reporting, validator policy, MEV handling, reserves, custody-platform support: we&apos;re
              happy to walk through any of it with your team.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href={LINKS.telegram} target="_blank" rel="noreferrer" className="btn-primary">
                Talk to our team <ArrowUpRight className="h-4 w-4" />
              </a>
              <a href={LINKS.twitter} target="_blank" rel="noreferrer" className="btn-ghost">
                Follow on X <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
