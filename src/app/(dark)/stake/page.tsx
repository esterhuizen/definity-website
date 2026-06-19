import type { Metadata } from 'next';
import { StakeProviders } from '@/components/stake/StakeProviders';
import { StakeWidget } from '@/components/stake/StakeWidget';

export const metadata: Metadata = {
  title: 'Stake',
  description:
    'Stake SOL into definSOL, Definity’s geographically-decentralised liquid staking token. Connect a wallet and convert SOL to definSOL in one click.',
};

export default function StakePage() {
  return (
    <section className="sec">
      <div className="wrap">
        <div className="chapter" style={{ justifyContent: 'center' }}>Stake</div>
        <header style={{ textAlign: 'center', maxWidth: '620px', margin: '18px auto 0' }}>
          <h1 className="sec-h" style={{ margin: '0 auto', maxWidth: 'none' }}>Stake SOL for <em>definSOL.</em></h1>
          <p className="sec-lede" style={{ margin: '18px auto 0' }}>
            Convert SOL into definSOL — Definity’s liquid staking token, backed by a curated,
            geographically-decentralised validator set. Liquid, tradeable, and earning from the
            moment you stake.
          </p>
        </header>

        <div className="stakeui" style={{ marginTop: '40px' }}>
          <StakeProviders>
            <StakeWidget />
          </StakeProviders>
        </div>

        <p style={{ textAlign: 'center', maxWidth: '440px', margin: '28px auto 0', fontSize: '11px', letterSpacing: '.06em', color: 'var(--faint)' }}>
          Coming next: choose the token your staking yield is paid in.
        </p>
      </div>
    </section>
  );
}
