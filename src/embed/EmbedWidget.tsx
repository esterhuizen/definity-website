'use client';

import { type ReactNode, useEffect, useState } from 'react';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';
import { useWallets, useConnect } from '@wallet-standard/react';
import {
  useSelectedWalletAccount,
  useWalletAccountTransactionSendingSigner,
  useSignAndSendTransaction,
} from '@solana/react';
import { SOLANA_CHAIN } from '@/lib/solana/constants';
import { directDepositSol } from '@/lib/solana/deposit';
import { waitForConfirmation, getDefinsolBalance } from '@/lib/solana/rpc';
import { quoteUnstake, buildUnstakeSwap, sigToBase58 } from '@/lib/solana/unstake';

export type EmbedConfig = {
  vote: string;
  ref: string | null;
  name: string | null;
  image: string | null;
  apiOrigin: string;
};

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
type Sub = { k: 'idle' } | { k: 'signing' } | { k: 'done'; sig: string } | { k: 'error'; m: string };

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

function WalletRow({ account }: { account: UiWalletAccount }) {
  const [, setSelected] = useSelectedWalletAccount();
  return (
    <div className="dfy-row">
      <span className="dfy-mono"><span className="dfy-dot" />{short(account.address)}</span>
      <button className="dfy-x" type="button" onClick={() => setSelected(undefined)}>Disconnect</button>
    </div>
  );
}

function Done({ title, children, sig, onReset, resetLabel }: { title: string; children: ReactNode; sig: string; onReset: () => void; resetLabel: string }) {
  return (
    <div className="dfy-ok">
      <div className="dfy-oki">✓</div>
      <div className="dfy-name">{title}</div>
      <div className="dfy-note">{children}</div>
      <a className="dfy-link" href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 13 }}>
        View transaction →
      </a>
      <div style={{ marginTop: 12 }}>
        <button className="dfy-x" type="button" onClick={onReset}>{resetLabel}</button>
      </div>
    </div>
  );
}

function StakePanel({ account, cfg }: { account: UiWalletAccount; cfg: EmbedConfig }) {
  const signer = useWalletAccountTransactionSendingSigner(account, SOLANA_CHAIN);
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
          /* cron backstop */
        }
      })();
    } catch (e) {
      setSub({ k: 'error', m: e instanceof Error ? e.message : String(e) });
    }
  }

  if (sub.k === 'done') {
    return (
      <Done title={`Staked to ${label}`} sig={sub.sig} onReset={() => { setSub({ k: 'idle' }); setAmount(''); }} resetLabel="Stake again">
        You deposited {amt} SOL and now hold liquid definSOL. Definity directs your stake onto {label} at the next cycle, then up to
        3.5× matching on top once it has been held a full epoch — up to 4.5× in total.
      </Done>
    );
  }

  return (
    <div>
      <div className="dfy-label">Amount to stake</div>
      <div className="dfy-amt">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.0" />
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

function UnstakePanel({ account }: { account: UiWalletAccount }) {
  const signAndSend = useSignAndSendTransaction(account, SOLANA_CHAIN);
  const [bal, setBal] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [out, setOut] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [sub, setSub] = useState<Sub>({ k: 'idle' });
  const amt = Number(amount);

  useEffect(() => {
    let alive = true;
    getDefinsolBalance(account.address).then((b) => { if (alive) setBal(b); }).catch(() => {});
    return () => { alive = false; };
  }, [account.address]);

  useEffect(() => {
    if (!(amt > 0)) { setOut(null); setQuoting(false); return; }
    let alive = true;
    setQuoting(true);
    const t = setTimeout(() => {
      quoteUnstake(amt)
        .then((q) => { if (alive) { setOut(q?.outSol ?? null); setQuoting(false); } })
        .catch(() => { if (alive) setQuoting(false); });
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [amt]);

  const can = amt > 0 && bal != null && amt <= bal + 1e-9 && sub.k !== 'signing';

  async function submit() {
    if (!(amt > 0)) return;
    try {
      setSub({ k: 'signing' });
      const bytes = await buildUnstakeSwap(account.address, amt);
      const { signature } = await signAndSend({ transaction: bytes });
      setSub({ k: 'done', sig: sigToBase58(signature) });
    } catch (e) {
      setSub({ k: 'error', m: e instanceof Error ? e.message : String(e) });
    }
  }

  if (sub.k === 'done') {
    return (
      <Done title="Unstaked" sig={sub.sig} onReset={() => { setSub({ k: 'idle' }); setAmount(''); }} resetLabel="Done">
        Redeemed {amt} definSOL for SOL into your wallet.
      </Done>
    );
  }

  return (
    <div>
      <div className="dfy-lblrow">
        <span className="dfy-label">Amount to unstake</span>
        {bal != null ? <button className="dfy-max" type="button" onClick={() => setAmount(String(bal))}>Max {bal.toFixed(3)} definSOL</button> : null}
      </div>
      <div className="dfy-amt">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.0" />
        <span>definSOL</span>
      </div>
      <div className="dfy-out">{quoting ? 'Fetching rate…' : out != null ? `≈ ${out.toFixed(4)} SOL` : 'Enter an amount to unstake'}</div>
      <button className="dfy-btn" type="button" disabled={!can} onClick={submit}>
        {sub.k === 'signing' ? 'Confirm in your wallet…' : 'Unstake to SOL'}
      </button>
      {sub.k === 'error' ? <div className="dfy-err">Failed: {sub.m}</div> : null}
      <div className="dfy-note">Redeems definSOL → SOL at the best market rate (via Jupiter), straight into your wallet. Signed by you.</div>
    </div>
  );
}

export function EmbedWidget({ cfg }: { cfg: EmbedConfig }) {
  const [selected] = useSelectedWalletAccount();
  const [mode, setMode] = useState<'stake' | 'unstake'>('stake');
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
        {selected ? (
          <>
            <WalletRow account={selected} />
            <div className="dfy-tabs">
              <button type="button" className={`dfy-tab ${mode === 'stake' ? 'dfy-tab-on' : ''}`} onClick={() => setMode('stake')}>Stake</button>
              <button type="button" className={`dfy-tab ${mode === 'unstake' ? 'dfy-tab-on' : ''}`} onClick={() => setMode('unstake')}>Unstake</button>
            </div>
            {mode === 'stake' ? <StakePanel account={selected} cfg={cfg} /> : <UnstakePanel account={selected} />}
          </>
        ) : (
          <Connect />
        )}
        <div className="dfy-foot">
          Powered by <a className="dfy-link" href="https://definity.finance/direct-staking" target="_blank" rel="noreferrer">Definity</a>
        </div>
      </div>
    </div>
  );
}
