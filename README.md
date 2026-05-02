# Definity

A Solana stake pool with a mission: turn staking yield into ecosystem growth in the regions shaping Solana's next chapter.

This repo is the public marketing + staking site for **definity.finance**. Users stake SOL and receive `definSOL` (a liquid staking token) by clicking through to Jupiter or Sanctum — Definity itself is non-custodial and never touches user keys.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **Routes out** to Jupiter (primary) and Sanctum (secondary) for the actual swap — both are audited, non-custodial, and load in a new tab so wallet signing happens entirely on their origins
- **Live on-chain stats** — validator count + total SOL staked refreshed hourly, plus per-validator geographic locations refreshed daily, all by a tiny zero-dependency Node script that reads the SPL stake-pool account directly and queries Stakewiz for the IP-based geo lookup
- **No managed PaaS** — builds to a Next.js standalone server, runs anywhere `node` runs (nginx + systemd + Let's Encrypt for production)

## Repo layout

```
src/
  app/                Next.js App Router pages
  components/         Page sections (Hero, StakeWidget, StatsRow, …)
  config/pool.ts      Pool address, mint, and outbound URLs (single source of truth)
scripts/
  fetch-pool-stats.mjs   Reads the on-chain pool state, writes public/stats.json
deploy/
  definity.service              systemd unit for the website
  deploy.sh                     atomic-swap deploy script
  nginx.conf                    full HTTPS config (use after TLS is issued)
  nginx-bootstrap.conf          HTTP-only config for the TLS bootstrap phase
  nginx-ratelimit.conf          /etc/nginx/conf.d/ rate-limit zone
  tls-issue.sh                  first-time Let's Encrypt cert issuance
  tls-renew.sh                  renewal script (runs from the timer)
  certbot-renew.service/.timer  systemd renewal pipeline
  pool-stats.service/.timer     systemd timer for hourly stats refresh
DEPLOY.md             full step-by-step install on a fresh Ubuntu/Debian box
```

## Local development

```bash
npm install              # install dependencies
npm run dev              # dev server with hot reload → http://localhost:3000
npm run build            # production build (writes .next/standalone/)
npm run start            # run the production build
npm run typecheck        # tsc --noEmit
npm run lint             # next lint
npm run stats:fetch      # populate public/stats.json manually (live RPC call)
```

`npm run dev` runs against an empty `public/stats.json` until you run `stats:fetch` once. The page handles the missing file gracefully (validator/stake tiles show `—`).

## Pool addresses

Wired in from `src/config/pool.ts` — change in one place if the pool ever migrates:

| What | Address |
| --- | --- |
| Stake pool | `Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL` |
| `definSOL` mint | `DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA` |

## Deployment

Self-hosted on a Linux server. nginx in front; the Next.js standalone bundle behind it under systemd. TLS via Let's Encrypt with automatic renewal. A second systemd timer keeps `public/stats.json` fresh on the disk.

**Quick path:**

```bash
git clone https://github.com/esterhuizen/definity-website.git
cd definity-website
# follow DEPLOY.md from here — about 10 minutes start to TLS
```

**The full sequence**, copy-paste-able from [DEPLOY.md](./DEPLOY.md):

1. System packages (Node 22 LTS, nginx, certbot via snap, ufw)
2. Firewall rules (`OpenSSH` + `Nginx Full`)
3. Create the `definity` system user + `/var/www/definity/`
4. Install systemd unit + bootstrap nginx config (HTTP only)
5. First atomic deploy via `deploy/deploy.sh`
6. Issue Let's Encrypt cert via `deploy/tls-issue.sh` (then swap to the full `nginx.conf`)
7. Enable auto-renewal: install `tls-renew.sh` to `/usr/local/sbin/` + `certbot-renew.timer`
8. Enable hourly stats: install `pool-stats.timer`, then `systemctl start pool-stats.service` once to populate
9. Future deploys: `sudo -u definity /var/www/definity/deploy.sh main`

## How the live stats pipeline works

Two completely separate processes, talking through files on disk:

- `pool-stats.timer` fires every hour → runs `node scripts/fetch-pool-stats.mjs` → reads on-chain via Solana RPC → writes `public/stats.json` atomically. Also extracts the pool's vote-account list and, **once every 24 hours**, queries Stakewiz to look up each validator's data-centre location → writes `public/validators.json` atomically.
- The Next.js website reads both JSON files from disk on each render (ISR window: 30 min). Zero remote calls happen on user requests.

Robustness:

- If the Solana RPC is down, the script exits non-zero and **leaves the existing `stats.json` untouched** — the site keeps showing the last good data.
- If Stakewiz is down or returns garbage, that part of the script logs the error but **doesn't fail the run** — the stats portion still writes, and the prior `validators.json` is left intact.
- If the website crashes, the timer keeps refreshing the files regardless.
- Atomic writes (write to `*.json.tmp-<pid>`, then rename) — the website never reads a half-written file.

To point the on-chain reads at a private RPC instead of public mainnet-beta, set `Environment=SOLANA_RPC=https://your.rpc` in `deploy/pool-stats.service`. Stakewiz can be swapped via `Environment=STAKEWIZ_URL=...`.

## Security notes

- **Non-custodial.** This site never touches user keys or SOL. Stake actions open Jupiter or Sanctum in a new tab and the user signs in their own wallet on those origins.
- **Strict CSP** in `next.config.js`: `frame-src` only allows `*.sanctum.so` and `*.jup.ag` (kept for any future re-introduction of an in-page widget). HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy locked down.
- **Hardened systemd units** for both `definity.service` and `pool-stats.service` (NoNewPrivileges, ProtectSystem=strict, ProtectHome, RestrictNamespaces, MemoryDenyWriteExecute).
- **No third-party analytics or trackers.**
- **No build-time secrets.** Anything sensitive happens client-side, in the user's wallet, on Jupiter/Sanctum's origin.

## License

MIT
