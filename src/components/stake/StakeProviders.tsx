'use client';

import type { ReactNode } from 'react';
import type { UiWallet } from '@wallet-standard/react';
import { SelectedWalletAccountContextProvider } from '@solana/react';
import { SOLANA_CHAIN } from '@/lib/solana/constants';

const STORAGE_KEY = 'definity:selected-wallet';

// Wallet discovery (useWallets) reads the global wallet-standard registry and
// needs no provider. We only need the selected-account context so the connect
// button and the deposit panel agree on which account is active, plus
// localStorage state-sync so the choice survives reloads.
export function StakeProviders({ children }: { children: ReactNode }) {
  return (
    <SelectedWalletAccountContextProvider
      filterWallets={(w: UiWallet) => w.chains.includes(SOLANA_CHAIN)}
      stateSync={{
        getSelectedWallet: () =>
          typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY),
        storeSelectedWallet: (key: string) => {
          if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, key);
        },
        deleteSelectedWallet: () => {
          if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
        },
      }}
    >
      {children}
    </SelectedWalletAccountContextProvider>
  );
}
