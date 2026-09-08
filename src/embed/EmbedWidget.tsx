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
import { waitForSignatureOutcome, getSolBalance, getDefinsolBalance } from '@/lib/solana/rpc';
import { quoteUnstake, buildUnstakeSwap, sigToBase58 } from '@/lib/solana/unstake';

export type EmbedConfig = {
  vote: string;
  ref: string | null;
  name: string | null;
  image: string | null;
  apiOrigin: string;
};

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
// 'confirming' = submitted, landing unknown; 'done' may only render AFTER
// on-chain confirmation (a signature alone is a submission receipt, and this
// widget once showed success for transactions that never landed). 'timeout' =
// still unresolved at the deadline — claim neither success nor failure.
type Sub =
  | { k: 'idle' }
  | { k: 'signing' }
  | { k: 'confirming'; sig: string }
  | { k: 'done'; sig: string; amt: number }
  | { k: 'timeout'; sig: string }
  | { k: 'error'; m: string; sig?: string };

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
  const [bal, setBal] = useState<number | null>(null);
  const amt = Number(amount);
  const over = bal != null && amt > Math.max(0, bal - 0.01) + 1e-9;
  const busy = sub.k === 'signing' || sub.k === 'confirming';
  const can = Number.isFinite(amt) && amt > 0 && !over && !busy;
  const label = cfg.name || short(cfg.vote);

  useEffect(() => {
    let alive = true;
    getSolBalance(account.address).then((b) => { if (alive) setBal(b); }).catch(() => {});
    return () => { alive = false; };
  }, [account.address]);

  async function submit() {
    if (!(amt > 0)) return;
    const staked = amt; // frozen: the field stays live during confirmation
    try {
      setSub({ k: 'signing' });
      const sig = await directDepositSol(signer, account.address, cfg.vote, staked);
      // Success only after confirmation — the signature is a submission receipt.
      setSub({ k: 'confirming', sig });
      const outcome = await waitForSignatureOutcome(sig);
      if (outcome === 'confirmed') {
        setSub({ k: 'done', sig, amt: staked });
        getSolBalance(account.address).then(setBal).catch(() => {});
        try {
          await fetch(`${cfg.apiOrigin}/api/direct-stake/ingest`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ signature: sig, ref: cfg.ref }),
          });
        } catch {
          /* cron backstop */
        }
      } else if (outcome === 'failed') {
        setSub({ k: 'error', sig, m: 'The transaction failed on-chain — nothing was staked (only the network fee was spent).' });
      } else {
        setSub({ k: 'timeout', sig });
      }
    } catch (e) {
      setSub({ k: 'error', m: e instanceof Error ? e.message : String(e) });
    }
  }

  if (sub.k === 'done') {
    return (
      <Done title={`Staked to ${label}`} sig={sub.sig} onReset={() => { setSub({ k: 'idle' }); setAmount(''); }} resetLabel="Stake again">
        You staked {sub.amt} SOL and now hold liquid definSOL. Definity directs your stake onto {label} at the next cycle, then up to
        3.5× matching on top once it has been held a full epoch — up to 4.5× in total.
      </Done>
    );
  }

  return (
    <div>
      <div className="dfy-lblrow">
        <span className="dfy-label">Amount to stake</span>
        {bal != null && bal - 0.01 > 0 ? (
          <button
            className="dfy-max"
            type="button"
            title="Leaves ~0.01 SOL for fees"
            onClick={() => setAmount((Math.floor((bal - 0.01) * 1e6) / 1e6).toFixed(6).replace(/\.?0+$/, ''))}
          >
            Max {(bal - 0.01).toFixed(3)} SOL
          </button>
        ) : bal != null ? (
          <span className="dfy-label">Balance {bal.toFixed(4)} SOL</span>
        ) : null}
      </div>
      <div className="dfy-amt">
        <input inputMode="decimal" value={amount} disabled={busy} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, '')); if (sub.k === 'error' || sub.k === 'timeout') setSub({ k: 'idle' }); }} placeholder="0.0" />
        <span>SOL</span>
      </div>
      {over ? <div className="dfy-err">Amount exceeds what your wallet can spend (~0.01 SOL stays behind for fees).</div> : null}
      <button className="dfy-btn" type="button" disabled={!can} onClick={submit}>
        {sub.k === 'signing' ? 'Confirm in your wallet…' : sub.k === 'confirming' ? 'Confirming on-chain…' : `Stake to ${label}`}
      </button>
      {sub.k === 'confirming' ? (
        <div className="dfy-note">Submitted — waiting for on-chain confirmation. <a className="dfy-link" href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer">View on Solscan →</a></div>
      ) : null}
      {sub.k === 'timeout' ? (
        <div className="dfy-note" style={{ color: '#fbbf24' }}>Still unconfirmed. <a className="dfy-link" href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer">Check the transaction</a> before retrying so you don't stake twice.</div>
      ) : null}
      {sub.k === 'error' ? <div className="dfy-err">Failed: {sub.m}{sub.sig ? <> <a className="dfy-link" href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer">Details →</a></> : null}</div> : null}
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

  const busy = sub.k === 'signing' || sub.k === 'confirming';
  const can = amt > 0 && bal != null && amt <= bal + 1e-9 && !busy;

  async function submit() {
    if (!(amt > 0)) return;
    const staked = amt; // frozen: the field stays live during confirmation
    try {
      setSub({ k: 'signing' });
      const bytes = await buildUnstakeSwap(account.address, staked);
      const { signature } = await signAndSend({ transaction: bytes });
      const sig = sigToBase58(signature);
      // Same rule as staking: 'Unstaked' only renders once confirmed on-chain.
      setSub({ k: 'confirming', sig });
      const outcome = await waitForSignatureOutcome(sig);
      if (outcome === 'confirmed') {
        setSub({ k: 'done', sig, amt: staked });
        getDefinsolBalance(account.address).then(setBal).catch(() => {});
      } else if (outcome === 'failed') {
        setSub({ k: 'error', sig, m: 'The transaction failed on-chain — nothing was unstaked (only the network fee was spent).' });
      } else {
        setSub({ k: 'timeout', sig });
      }
    } catch (e) {
      setSub({ k: 'error', m: e instanceof Error ? e.message : String(e) });
    }
  }

  if (sub.k === 'done') {
    return (
      <Done title="Unstaked" sig={sub.sig} onReset={() => { setSub({ k: 'idle' }); setAmount(''); }} resetLabel="Done">
        Redeemed {sub.amt} definSOL for SOL into your wallet.
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
        <input inputMode="decimal" value={amount} disabled={busy} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, '')); if (sub.k === 'error' || sub.k === 'timeout') setSub({ k: 'idle' }); }} placeholder="0.0" />
        <span>definSOL</span>
      </div>
      <div className="dfy-out">{quoting ? 'Fetching rate…' : out != null ? `≈ ${out.toFixed(4)} SOL` : 'Enter an amount to unstake'}</div>
      <button className="dfy-btn" type="button" disabled={!can} onClick={submit}>
        {sub.k === 'signing' ? 'Confirm in your wallet…' : sub.k === 'confirming' ? 'Confirming on-chain…' : 'Unstake to SOL'}
      </button>
      {sub.k === 'confirming' ? (
        <div className="dfy-note">Submitted — waiting for on-chain confirmation. <a className="dfy-link" href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer">View on Solscan →</a></div>
      ) : null}
      {sub.k === 'timeout' ? (
        <div className="dfy-note" style={{ color: '#fbbf24' }}>Still unconfirmed. <a className="dfy-link" href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer">Check the transaction</a> before retrying.</div>
      ) : null}
      {sub.k === 'error' ? <div className="dfy-err">Failed: {sub.m}{sub.sig ? <> <a className="dfy-link" href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer">Details →</a></> : null}</div> : null}
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
            {/* Both panels stay mounted — unmounting during a confirmation wait
                would silently discard the outcome; hide with CSS instead. */}
            <div style={{ display: mode === 'stake' ? undefined : 'none' }}><StakePanel account={selected} cfg={cfg} /></div>
            <div style={{ display: mode === 'unstake' ? undefined : 'none' }}><UnstakePanel account={selected} /></div>
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
