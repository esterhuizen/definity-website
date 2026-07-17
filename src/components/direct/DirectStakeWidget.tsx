'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { useSelectedWalletAccount, useWalletAccountTransactionSendingSigner } from '@solana/react';
import { Search, Check, X, ArrowUpRight } from 'lucide-react';
import { ConnectWallet } from '../stake/ConnectWallet';
import { SOLANA_CHAIN } from '@/lib/solana/constants';
import { directDepositSol } from '@/lib/solana/deposit';
import { waitForConfirmation } from '@/lib/solana/rpc';

type V = {
  vote: string;
  name: string | null;
  city: string | null;
  country: string | null;
  image: string | null;
  activatedStakeSol: number | null;
  /** Approved to join (Notion-Active) but the on-chain seat lands at the next
   *  optimiser cycle. Directable immediately — the maturity clock is
   *  wallet-bound and starts at deposit, not at seat creation. */
  pending?: boolean;
};

type SubState =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'done'; signature: string }
  | { kind: 'error'; message: string };

function short(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function RequestPanel({ account }: { account: UiWalletAccount }) {
  const txSigner = useWalletAccountTransactionSendingSigner(account, SOLANA_CHAIN);
  const [, setSelected] = useSelectedWalletAccount();

  const [vals, setVals] = useState<V[]>([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<V | null>(null);
  const [amount, setAmount] = useState('');
  const [sub, setSub] = useState<SubState>({ kind: 'idle' });

  useEffect(() => {
    let alive = true;
    fetch('/validators.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.validators) setVals(d.validators as V[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...vals].sort((a, b) => (b.activatedStakeSol ?? 0) - (a.activatedStakeSol ?? 0));
    if (!q) return []; // search-only: no list until the user types
    return base
      .filter(
        (v) =>
          (v.name || '').toLowerCase().includes(q) ||
          v.vote.toLowerCase().includes(q) ||
          (v.city || '').toLowerCase().includes(q) ||
          (v.country || '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [vals, query]);

  const amt = Number(amount);
  const canSubmit = !!picked && Number.isFinite(amt) && amt > 0 && sub.kind !== 'signing';

  async function onSubmit() {
    if (!picked || !(amt > 0)) return;
    try {
      setSub({ kind: 'signing' });
      const signature = await directDepositSol(txSigner, account.address, picked.vote, amt);
      setSub({ kind: 'done', signature });
      // Notify the backend the moment it confirms so the requests dashboard
      // reflects it within seconds (the 5-min cron is the backstop).
      void (async () => {
        try {
          await waitForConfirmation(signature);
          await fetch('/api/direct-stake/ingest', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ signature }),
          });
        } catch {
          /* the cron will pick it up */
        }
      })();
    } catch (e) {
      setSub({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  if (sub.kind === 'done') {
    return (
      <div className="space-y-3 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
          <Check className="h-6 w-6 text-success" aria-hidden="true" />
        </div>
        <p className="font-display text-lg font-semibold text-ink">Directed to {picked?.name || short(picked!.vote)}</p>
        <p className="text-sm text-ink-muted">
          You deposited {amt} SOL and now hold definSOL. Definity directs your stake onto your chosen validator at the
          next optimiser cycle, then up to 3.5× matching on top once it has been held a full epoch — up to 4.5× in total
          (capped 20,000 SOL/validator).
        </p>
        <a
          className="inline-flex items-center gap-1 text-sm text-ink underline underline-offset-2"
          href={`https://solscan.io/tx/${sub.signature}`}
          target="_blank"
          rel="noreferrer"
        >
          View transaction <ArrowUpRight className="h-3 w-3" />
        </a>
        <div>
          <button
            type="button"
            className="text-sm text-ink-dim underline-offset-2 hover:text-ink hover:underline"
            onClick={() => {
              setSub({ kind: 'idle' });
              setPicked(null);
              setAmount('');
              setQuery('');
            }}
          >
            Stake to another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Connected wallet */}
      <div className="flex items-center justify-between rounded-xl border border-ring bg-bg-muted/60 px-4 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-ink-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-success" aria-hidden="true" />
          <span className="font-mono text-ink">{short(account.address)}</span>
        </span>
        <button
          type="button"
          className="text-ink-dim underline-offset-2 hover:text-ink hover:underline"
          onClick={() => setSelected(undefined)}
        >
          Disconnect
        </button>
      </div>

      {/* Validator picker */}
      <div className="rounded-xl border border-ring bg-bg-muted/60 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-dim">Choose a validator</div>
        {picked ? (
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-sunrise-300 bg-bg px-3 py-2">
            {picked.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picked.image} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <span className="h-7 w-7 rounded-full bg-ring" aria-hidden="true" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{picked.name || short(picked.vote)}</span>
              <span className="block truncate font-mono text-xs text-ink-dim">
                {short(picked.vote)}
                {picked.city ? ` · ${picked.city}` : ''}
                {picked.country ? `, ${picked.country}` : ''}
              </span>
              {picked.pending ? (
                <span className="block text-xs text-sunrise-300">
                  Joining the pool — you can direct now; your stake matures from deposit and directs once the validator is added.
                </span>
              ) : null}
            </span>
            <button
              type="button"
              className="ml-auto text-ink-dim hover:text-ink"
              aria-label="Clear selection"
              onClick={() => setPicked(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-ring bg-bg px-3 py-2">
              <Search className="h-4 w-4 text-ink-dim" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, city, or vote pubkey"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-dim"
              />
            </div>
            {query.trim() ? (
              <ul className="mt-2 max-h-60 space-y-1 overflow-auto">
                {results.map((v) => (
                  <li key={v.vote}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(v);
                        setQuery('');
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-bg"
                    >
                      {v.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.image} alt="" className="h-6 w-6 rounded-full" />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-ring" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">
                          {v.name || short(v.vote)}
                          {v.pending ? (
                            <span className="ml-2 rounded bg-sunrise-300/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sunrise-300">
                              joining
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-ink-dim">
                          {short(v.vote)}
                          {v.city ? ` · ${v.city}` : ''}
                        </span>
                      </span>
                      {v.activatedStakeSol != null ? (
                        <span className="shrink-0 font-mono text-[11px] text-ink-dim">
                          {Math.round(v.activatedStakeSol / 1000)}k◎
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
                {results.length === 0 ? (
                  <li className="px-2 py-3 text-center text-xs text-ink-dim">No vetted validator matches.</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-2 px-1 text-[11px] text-ink-dim">
                Search Definity&apos;s vetted set by name, city, or vote pubkey. Pick one to direct your stake.
              </p>
            )}
          </>
        )}
      </div>

      {/* Amount */}
      <div className="rounded-xl border border-ring bg-bg-muted/60 p-5">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-dim">Amount to direct-stake</div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.0"
            className="w-full min-w-0 bg-transparent font-display text-3xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink-dim md:text-4xl"
          />
          <span className="shrink-0 font-medium text-ink-muted">SOL</span>
        </div>
        <p className="mt-2 text-xs text-ink-dim">
          You deposit SOL and receive definSOL. Definity directs your stake onto your chosen validator at the next cycle,
          then up to 3.5× matching on top — up to 4.5× in total, capped at 20,000 SOL per validator and 60,000 total.
          Decentralisation is disclosed, never used to block your choice.
        </p>
      </div>

      {/* Submit */}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="btn-primary mt-1 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sub.kind === 'signing' ? 'Confirm in your wallet…' : 'Stake to validator'}
      </button>

      {sub.kind === 'error' ? (
        <p className="break-words text-center text-sm text-fuchsia-600">Failed: {sub.message}</p>
      ) : null}
    </div>
  );
}

export function DirectStakeWidget() {
  const [selected] = useSelectedWalletAccount();
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="surface relative overflow-hidden p-6 shadow-glow-sm md:p-8">
        <div className="absolute inset-0 bg-dawn-gradient opacity-50" aria-hidden="true" />
        <div className="relative">{selected ? <RequestPanel account={selected} /> : <ConnectWallet />}</div>
      </div>
    </div>
  );
}
