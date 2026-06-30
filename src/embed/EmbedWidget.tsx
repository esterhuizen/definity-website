'use client';

import { useState } from 'react';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';
import { useWallets, useConnect } from '@wallet-standard/react';
import { useSelectedWalletAccount, useWalletAccountTransactionSendingSigner } from '@solana/react';
import { SOLANA_CHAIN } from '@/lib/solana/constants';
import { directDepositSol } from '@/lib/solana/deposit';
import { waitForConfirmation } from '@/lib/solana/rpc';

export type EmbedConfig = {
  vote: string;
  ref: string | null;
  name: string | null;
  image: string | null;
  apiOrigin: string;
};

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

function WalletButton({ wallet, onPick }: { wallet: UiWallet; onPick: (a: UiWalletAccount) => void }) {
  const [busy, connect] = useConnect(wallet);
  return (
    <button
      className="dfy-wbtn"
      type="button"
      disabled={busy}
      onClick={async () => {
        try {
          const accts = await connect();
          if (accts[0]) onPick(accts[0]);
        } catch {
          /* user dismissed */
        }
      }}
    >
      {wallet.icon ? <img src={wallet.icon} alt="" /> : null}
      {wallet.name}
      {busy ? <span style={{ marginLeft: 'auto', color: '#6b7894' }}>connecting…</span> : null}
    </button>
  );
}

function Connect() {
  const wallets = useWallets().filter((w) => w.chains.includes(SOLANA_CHAIN));
  const [, setSelected] = useSelectedWalletAccount();
  if (wallets.length === 0) {
    return (
      <div className="dfy-note">
        No Solana wallet detected — install{' '}
        <a className="dfy-link" href="https://phantom.app" target="_blank" rel="noreferrer">Phantom</a>,{' '}
        <a className="dfy-link" href="https://solflare.com" target="_blank" rel="noreferrer">Solflare</a>, or{' '}
        <a className="dfy-link" href="https://backpack.app" target="_blank" rel="noreferrer">Backpack</a>.
      </div>
    );
  }
  return (
    <div style={{ marginTop: 14 }}>
      {wallets.map((w) => (
        <WalletButton key={w.name} wallet={w} onPick={(a) => setSelected(a)} />
      ))}
    </div>
  );
}

type Sub = { k: 'idle' } | { k: 'signing' } | { k: 'done'; sig: string } | { k: 'error'; m: string };

function Panel({ account, cfg }: { account: UiWalletAccount; cfg: EmbedConfig }) {
  const signer = useWalletAccountTransactionSendingSigner(account, SOLANA_CHAIN);
  const [, setSelected] = useSelectedWalletAccount();
  const [amount, setAmount] = useState('');
  const [sub, setSub] = useState<Sub>({ k: 'idle' });
  const amt = Number(amount);
  const can = Number.isFinite(amt) && amt > 0 && sub.k !== 'signing';
  const label = cfg.name || short(cfg.vote);

  async function submit() {
    if (!(amt > 0)) return;
    try {
      setSub({ k: 'signing' });
      const sig = await directDepositSol(signer, account.address, cfg.vote, amt);
      setSub({ k: 'done', sig });
      void (async () => {
        try {
          await waitForConfirmation(sig);
          await fetch(`${cfg.apiOrigin}/api/direct-stake/ingest`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ signature: sig, ref: cfg.ref }),
          });
        } catch {
          /* the cron scanner is the backstop */
        }
      })();
    } catch (e) {
      setSub({ k: 'error', m: e instanceof Error ? e.message : String(e) });
    }
  }

  if (sub.k === 'done') {
    return (
      <div className="dfy-ok">
        <div className="dfy-oki">✓</div>
        <div className="dfy-name">Staked to {label}</div>
        <div className="dfy-note">
          You deposited {amt} SOL and now hold liquid definSOL. Definity directs your stake onto {label} at the next cycle,
          then up to 3.5× matching on top once it has been held a full epoch — up to 4.5× in total.
        </div>
        <a
          className="dfy-link"
          href={`https://solscan.io/tx/${sub.sig}`}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'inline-block', marginTop: 10, fontSize: 13 }}
        >
          View transaction →
        </a>
        <div style={{ marginTop: 12 }}>
          <button className="dfy-x" type="button" onClick={() => { setSub({ k: 'idle' }); setAmount(''); }}>
            Stake again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="dfy-row">
        <span className="dfy-mono"><span className="dfy-dot" />{short(account.address)}</span>
        <button className="dfy-x" type="button" onClick={() => setSelected(undefined)}>Disconnect</button>
      </div>
      <div className="dfy-label">Amount to stake</div>
      <div className="dfy-amt">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0.0"
        />
        <span>SOL</span>
      </div>
      <button className="dfy-btn" type="button" disabled={!can} onClick={submit}>
        {sub.k === 'signing' ? 'Confirm in your wallet…' : `Stake to ${label}`}
      </button>
      {sub.k === 'error' ? <div className="dfy-err">Failed: {sub.m}</div> : null}
      <div className="dfy-note">
        Your stake plus up to 3.5× matching is directed onto {label} — up to 4.5× in total. You hold liquid definSOL; Definity never takes custody.
      </div>
    </div>
  );
}

export function EmbedWidget({ cfg }: { cfg: EmbedConfig }) {
  const [selected] = useSelectedWalletAccount();
  return (
    <div className="dfy">
      <div className="dfy-card">
        <div className="dfy-eyebrow">Direct stake</div>
        <div className="dfy-val">
          {cfg.image ? <img className="dfy-ava" src={cfg.image} alt="" /> : <span className="dfy-ava" />}
          <div>
            <div className="dfy-name">{cfg.name || 'Your validator'}</div>
            <div className="dfy-mono">{short(cfg.vote)}</div>
          </div>
        </div>
        {selected ? <Panel account={selected} cfg={cfg} /> : <Connect />}
        <div className="dfy-foot">
          Powered by <a className="dfy-link" href="https://definity.finance/direct-staking" target="_blank" rel="noreferrer">Definity</a>
        </div>
      </div>
    </div>
  );
}
