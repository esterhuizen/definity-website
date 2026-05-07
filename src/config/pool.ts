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
  // Sanctum's deep-link pattern uses the LST ticker symbol (NOT the mint).
  sanctumLst: `https://app.sanctum.so/trade/SOL-${POOL.lstSymbol}`,
  // Jupiter swap pre-filled SOL → definSOL (mint addresses, query-string form).
  jupiterSwap: `https://jup.ag/swap?sell=${POOL.solMint}&buy=${POOL.lstMint}`,
  // Block explorers
  solscanPool: `https://solscan.io/account/${POOL.stakePoolAddress}`,
  solscanMint: `https://solscan.io/token/${POOL.lstMint}`,

  twitter: 'https://x.com/realdefinity',
  // Single Telegram link: the operator's personal handle. There is no
  // separate "DefinityFinance" channel — every "Telegram" reference on the
  // site points here.
  telegram: 'https://t.me/realtielman',
  telegramHandle: '@realtielman',
  oldSite: 'https://definity.finance',
} as const;

export const SITE = {
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://definity.finance',
  title: 'Definity — Stake SOL, grow the ecosystem where it matters most',
  description:
    'Definity is a Solana stake pool that turns staking yield into ecosystem growth in regions that need it most. Stake SOL, receive definSOL, keep your liquidity.',
} as const;
