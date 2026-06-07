'use client';

import { useState } from 'react';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';
import { useWallets, useConnect, useDisconnect } from '@wallet-standard/react';
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
      className="flex w-full items-center gap-3 rounded-lg border border-neutral-700 px-4 py-3 text-left hover:border-neutral-500 disabled:opacity-50"
    >
      {wallet.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wallet.icon} alt="" className="h-6 w-6 rounded" />
      ) : null}
      <span className="font-medium">{wallet.name}</span>
      {isConnecting ? <span className="ml-auto text-sm text-neutral-400">connecting…</span> : null}
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
      className="text-sm text-neutral-400 underline hover:text-neutral-200 disabled:opacity-50"
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
      <div className="flex items-center justify-between rounded-lg border border-neutral-700 px-4 py-3">
        <span className="font-mono text-sm">{short(selected.address)}</span>
        <DisconnectButton account={selected} />
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-700 px-4 py-3 text-sm text-neutral-400">
        No Solana wallet detected. Install{' '}
        <a className="underline" href="https://phantom.app" target="_blank" rel="noreferrer">Phantom</a>,{' '}
        <a className="underline" href="https://solflare.com" target="_blank" rel="noreferrer">Solflare</a>, or{' '}
        <a className="underline" href="https://backpack.app" target="_blank" rel="noreferrer">Backpack</a>.
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-neutral-900 hover:bg-neutral-200"
      >
        Connect wallet
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          {wallets.map((w) => (
            <WalletOption key={w.name} wallet={w} onConnected={(a) => { setSelected(a); setOpen(false); }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
