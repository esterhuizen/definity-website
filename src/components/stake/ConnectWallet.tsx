'use client';

import { useState } from 'react';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';
import { useWallets, useConnect, useDisconnect } from '@wallet-standard/react';
import { Wallet } from 'lucide-react';
import { useSelectedWalletAccount } from '@solana/react';
import { SOLANA_CHAIN } from '@/lib/solana/constants';

function short(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// Only wallets that support Solana mainnet.
function supportsMainnet(w: UiWallet) {
  return w.chains.includes(SOLANA_CHAIN);
}

function WalletOption({
  wallet,
  onConnected,
}: {
  wallet: UiWallet;
  onConnected: (a: UiWalletAccount) => void;
}) {
  const [isConnecting, connect] = useConnect(wallet);
  return (
    <button
      type="button"
      disabled={isConnecting}
      onClick={async () => {
        try {
          const accounts = await connect();
          if (accounts[0]) onConnected(accounts[0]);
        } catch (e) {
          console.error('connect failed', e);
        }
      }}
      className="flex w-full items-center gap-3 rounded-xl border border-ring bg-bg px-4 py-3 text-left transition hover:border-ink-dim hover:bg-bg-muted disabled:opacity-50"
    >
      {wallet.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wallet.icon} alt="" className="h-6 w-6 rounded" />
      ) : null}
      <span className="font-medium text-ink">{wallet.name}</span>
      {isConnecting ? <span className="ml-auto text-sm text-ink-dim">connecting…</span> : null}
    </button>
  );
}

function DisconnectButton({ account }: { account: UiWalletAccount }) {
  const wallets = useWallets();
  const owner = wallets.find((w) => w.accounts.some((a) => a.address === account.address));
  const [isDisconnecting, disconnect] = useDisconnect(owner ?? wallets[0]);
  const [, setSelected] = useSelectedWalletAccount();
  return (
    <button
      type="button"
      disabled={isDisconnecting || !owner}
      onClick={async () => {
        try {
          await disconnect();
        } finally {
          setSelected(undefined);
        }
      }}
      className="text-sm text-ink-dim underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
    >
      Disconnect
    </button>
  );
}

export function ConnectWallet() {
  const wallets = useWallets().filter(supportsMainnet);
  const [selected, setSelected] = useSelectedWalletAccount();
  const [open, setOpen] = useState(false);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-ring bg-bg-muted/60 px-4 py-3">
        <span className="font-mono text-sm text-ink">{short(selected.address)}</span>
        <DisconnectButton account={selected} />
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="rounded-xl border border-ring bg-bg-muted/60 px-4 py-4 text-sm text-ink-muted">
        No Solana wallet detected. Install{' '}
        <a className="text-ink underline underline-offset-2" href="https://phantom.app" target="_blank" rel="noreferrer">Phantom</a>,{' '}
        <a className="text-ink underline underline-offset-2" href="https://solflare.com" target="_blank" rel="noreferrer">Solflare</a>, or{' '}
        <a className="text-ink underline underline-offset-2" href="https://backpack.app" target="_blank" rel="noreferrer">Backpack</a>.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="font-display text-lg font-semibold text-ink">Connect a wallet to stake</p>
        <p className="mt-1 text-sm text-ink-muted">
          Definity never takes custody — every action is signed by you.
        </p>
      </div>

      {open ? (
        <div className="space-y-2">
          {wallets.map((w) => (
            <WalletOption key={w.name} wallet={w} onConnected={(a) => { setSelected(a); setOpen(false); }} />
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full text-center text-xs text-ink-dim hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-primary w-full"
        >
          <Wallet className="h-4 w-4" aria-hidden="true" /> Connect wallet
        </button>
      )}
    </div>
  );
}
