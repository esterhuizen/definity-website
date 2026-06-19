import type { Metadata } from 'next';
import { LINKS, POOL } from '@/config/pool';

export const metadata: Metadata = {
  title: 'Pool & token IDs',
  description:
    'Public on-chain addresses for the Definity stake pool and the definSOL liquid staking token.',
};

const ROWS = [
  {
    label: 'Definity stake pool',
    value: POOL.stakePoolAddress,
    href: LINKS.solscanPool,
    note: 'The on-chain pool account. Holds the validator list, fee config, and reserve.',
  },
  {
    label: `${POOL.lstSymbol} mint`,
    value: POOL.lstMint,
    href: LINKS.solscanMint,
    note: 'The SPL token mint for definSOL. Used by wallets, explorers and DeFi integrations.',
  },
];

export default function AddressesPage() {
  return (
    <section className="sec">
      <div className="wrap">
        <div className="chapter">Pool &amp; token IDs</div>
        <div className="sec-head">
          <h1 className="sec-h">Addresses you can <em>verify.</em></h1>
          <p className="sec-lede">Everything that matters about Definity lives on-chain. These are the canonical addresses — bookmark them, and check every claim yourself.</p>
        </div>

        <div className="addrs">
          {ROWS.map((r) => (
            <div className="addr" key={r.value}>
              <div>
                <div className="al">{r.label}</div>
                <div className="av">{r.value}</div>
                <div className="an">{r.note}</div>
              </div>
              <a href={r.href} target="_blank" rel="noopener noreferrer">View on Solscan →</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
