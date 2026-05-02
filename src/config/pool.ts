// Single source of truth for on-chain pool identifiers and external integration URLs.
// If addresses ever change, update only this file.

export const POOL = {
  name: 'Definity',
  lstSymbol: 'definSOL',
  lstName: 'Definity Liquid SOL',

  // Sourced from definity.finance/addresses
  stakePoolAddress: 'Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL',
  lstMint: 'DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA',

  solMint: 'So11111111111111111111111111111111111111112',
} as const;

export const LINKS = {
  // Sanctum LST page for definSOL — used for the embedded widget and external CTA.
  sanctumLst: `https://app.sanctum.so/lst/${POOL.lstMint}`,
  // Jupiter swap pre-filled SOL → definSOL.
  jupiterSwap: `https://jup.ag/swap/SOL-${POOL.lstMint}`,
  // Block explorers
  solscanPool: `https://solscan.io/account/${POOL.stakePoolAddress}`,
  solscanMint: `https://solscan.io/token/${POOL.lstMint}`,

  twitter: 'https://twitter.com/DefinityFinance',
  telegram: 'https://t.me/DefinityFinance',
  github: 'https://github.com/esterhuizen/definity-website',
  oldSite: 'https://definity.finance',
} as const;

export const SITE = {
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://definity.finance',
  title: 'Definity — Stake SOL, grow the ecosystem where it matters most',
  description:
    'Definity is a Solana stake pool that turns staking yield into ecosystem growth in regions that need it most. Stake SOL, receive definSOL, keep your liquidity.',
} as const;
