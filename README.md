# Definity

A Solana stake pool with a mission: turn staking yield into ecosystem growth in the regions shaping Solana's next chapter.

This repo is the public marketing + staking site for **definity.finance**. Stake SOL → receive `definSOL` (a liquid staking token) via the embedded Sanctum widget.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **Sanctum** widget for SOL ↔ definSOL conversion (audited; non-custodial)
- **No managed PaaS** — builds to a Next.js standalone server, runs anywhere `node` runs

## Local development

```bash
npm install
npm run dev          # → http://localhost:3000
npm run build        # production build
npm run typecheck
npm run lint
```

## Pool addresses

Wired in from `src/config/pool.ts`:

| What | Address |
| --- | --- |
| Stake pool | `Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL` |
| `definSOL` mint | `DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA` |

If the pool is ever migrated, change those constants in one file.

## Deployment

Self-hosted on a Linux server (nginx + systemd + certbot). See [DEPLOY.md](./DEPLOY.md) for copy-paste install steps.

## Security notes

- Non-custodial: this site never touches user keys or SOL. Wallet signing happens inside the Sanctum iframe in the user's own browser.
- Strict CSP set in `next.config.js` — only `*.sanctum.so` and `*.jup.ag` are allowed as iframe sources.
- No third-party analytics or trackers.
- HSTS / X-Content-Type-Options / Referrer-Policy / Permissions-Policy all enabled.

## License

MIT
