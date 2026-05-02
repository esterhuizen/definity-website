# Definity

A Solana stake pool with a mission: turn staking yield into ecosystem growth in the regions shaping Solana's next chapter.

This repo is the public marketing + staking site for **definity.finance**. Users stake SOL and receive `definSOL` (a liquid staking token) by clicking through to Jupiter or Sanctum — Definity itself is non-custodial and never touches user keys.

> **For Claude / future maintainers:** `CLAUDE.md` in the repo root has a focused operations cheat sheet (deploy, roll back, force-refresh pipelines, log tailing, etc.) — read it after this README.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **Routes out** to Jupiter (primary) and Sanctum (secondary) for the actual swap — both are audited, non-custodial, and load in a new tab so wallet signing happens entirely on their origins
- **Embedded Typeform** on `/whitelist-apply` for validator applications
- **Live on-chain stats** — validator count + total SOL staked refreshed hourly, plus per-validator geographic locations refreshed daily
- **First-party analytics** — `/api/track` accepts page views and CTA-click events; nightly systemd job aggregates them into a daily HTML report. No cookies, no third-party SDK, no IP logged
- **No managed PaaS** — builds to a Next.js standalone server, runs anywhere `node` runs (nginx + systemd + Let's Encrypt for production)

## Repo layout

```
src/
  app/                 Next.js App Router pages + the /api/track route
  components/          Page sections (Hero, StakeWidget, ValidatorMap, …)
  config/pool.ts       Pool address, mint, outbound URLs (single source of truth)
  lib/track.ts         Client analytics helper (sendBeacon → /api/track)
scripts/
  fetch-pool-stats.mjs Reads on-chain pool state hourly, refreshes validator geo daily
  daily-report.mjs     Aggregates yesterday's events into an HTML report
deploy/
  definity.service              systemd unit for the website
  deploy.sh                     atomic-swap deploy script
  nginx.conf                    full HTTPS config (use after TLS is issued)
  nginx-bootstrap.conf          HTTP-only config for the TLS bootstrap phase
  nginx-ratelimit.conf          /etc/nginx/conf.d/ rate-limit zone
  tls-issue.sh                  first-time Let's Encrypt cert issuance
  tls-renew.sh                  renewal script (called by certbot-renew.timer)
  certbot-renew.{service,timer} systemd renewal pipeline
  pool-stats.{service,timer}    hourly stats refresh
  daily-report.{service,timer}  nightly visitor-report generator
CLAUDE.md              Operations cheat sheet (read after this README)
DEPLOY.md              Long-form install guide (mostly mirrors §3 below)
```

---

## 1 · Local development

```bash
git clone https://github.com/esterhuizen/definity-website.git
cd definity-website
npm install
npm run stats:fetch              # populate public/stats.json + validators.json from live mainnet (one-time, optional)
npm run dev                      # → http://localhost:3000
```

Useful npm scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build → `.next/standalone/` |
| `npm run start` | Run the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run stats:fetch` | Manually populate `public/stats.json` + `public/validators.json` |

`npm run dev` works against an empty `public/stats.json` (the StatsRow + ValidatorMap show `—` placeholders) until you run `stats:fetch` once.

To capture local analytics events while developing, set `EVENTS_LOG_PATH` to something writable in your project dir (see `.env.example`):

```bash
EVENTS_LOG_PATH=./events.jsonl npm run dev
```

---

## 2 · Pool addresses

Wired in from `src/config/pool.ts` — change in one place if the pool ever migrates:

| What | Address |
| --- | --- |
| Stake pool | `Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL` |
| `definSOL` mint | `DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA` |
| Whitelist application form (Typeform) | `01JY0GPM667JFMXDBYDEHQ4Q94` |

---

## 3 · Production deployment (Linux, self-hosted)

Target: a fresh Ubuntu 22.04+ or Debian 12 VPS. ~10 minutes start-to-TLS. The same content is in [DEPLOY.md](./DEPLOY.md) if you prefer it as a separate doc.

### Pre-flight

- DNS for `definity.finance` and `www.definity.finance` points at your server's IP.
- You have SSH + sudo on the box.
- Optional but recommended: put **Cloudflare** (free tier) in front for DDoS / CDN.

### 3.1 System packages

```bash
sudo apt update
sudo apt install -y curl ca-certificates git nginx ufw

# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# certbot via snap (most-current path on Ubuntu/Debian)
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot

# Optional, used by the daily report if present:
sudo apt install -y goaccess
```

### 3.2 Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 3.3 Application user + directories

```bash
sudo useradd --system --shell /usr/sbin/nologin --home-dir /var/www/definity definity
sudo mkdir -p /var/www/definity /var/lib/definity /var/www/certbot
sudo chown -R definity:definity /var/www/definity /var/lib/definity
```

### 3.4 Bootstrap nginx (HTTP only, before TLS exists)

```bash
sudo cp deploy/definity.service        /etc/systemd/system/definity.service
sudo cp deploy/nginx-bootstrap.conf    /etc/nginx/sites-available/definity
sudo cp deploy/nginx-ratelimit.conf    /etc/nginx/conf.d/definity-ratelimit.conf
sudo ln -sf /etc/nginx/sites-available/definity /etc/nginx/sites-enabled/definity
sudo nginx -t && sudo systemctl reload nginx
```

### 3.5 First deploy of the website

```bash
sudo -u definity cp deploy/deploy.sh /var/www/definity/deploy.sh
sudo chmod +x /var/www/definity/deploy.sh
sudo -u definity /var/www/definity/deploy.sh main
```

The script clones the repo into `/var/www/definity/repo.git` (bare), checks out `main` into a stamped release dir, runs `npm ci` + `npm run build`, then atomically symlink-swaps `/var/www/definity/current/` to it. Old releases are kept (last 3) for one-command rollback.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now definity
sudo systemctl status definity        # should be active (running)
```

### 3.6 TLS certificate

Verify DNS is correct *before* asking Let's Encrypt for a cert (they rate-limit failures):

```bash
dig +short definity.finance
dig +short www.definity.finance
```

Rehearse with the staging endpoint first:

```bash
sudo DRY_RUN=1 deploy/tls-issue.sh
```

Then issue the real cert:

```bash
sudo deploy/tls-issue.sh
```

Swap to the full HTTPS nginx config now that certs exist:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/definity
sudo nginx -t && sudo systemctl reload nginx
```

Visit `https://definity.finance` — you should see the site.

### 3.7 Automatic TLS renewal

```bash
sudo cp deploy/tls-renew.sh           /usr/local/sbin/tls-renew.sh
sudo chmod +x                         /usr/local/sbin/tls-renew.sh
sudo cp deploy/certbot-renew.service  /etc/systemd/system/
sudo cp deploy/certbot-renew.timer    /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now certbot-renew.timer
```

Renewal fires twice a day with up to 1h jitter; `nginx` only reloads when a cert was actually replaced (`--deploy-hook`). Test the pipeline without touching the live cert:

```bash
sudo /usr/local/sbin/tls-renew.sh --dry-run
```

### 3.8 Hourly on-chain stats

```bash
sudo cp deploy/pool-stats.service /etc/systemd/system/
sudo cp deploy/pool-stats.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pool-stats.timer
sudo systemctl start pool-stats.service        # populate stats.json + validators.json now
sudo cat /var/www/definity/current/public/stats.json
```

If you outgrow the public mainnet RPC, point at a private one:

```bash
sudo systemctl edit pool-stats.service         # add Environment=SOLANA_RPC=https://your.private.rpc
```

### 3.9 Daily visitor report (analytics)

```bash
sudo cp deploy/daily-report.service /etc/systemd/system/
sudo cp deploy/daily-report.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now daily-report.timer

# Force first run for a baseline:
sudo systemctl start daily-report.service
sudo cat /var/www/definity/current/public/reports/latest-summary.txt
```

The daily report lands at `https://definity.finance/reports/latest.html`. **Protect it with nginx basic auth** before traffic builds up — add to `nginx.conf`'s HTTPS block:

```nginx
location /reports/ {
    auth_basic "Definity reports";
    auth_basic_user_file /etc/nginx/.htpasswd-reports;
    proxy_pass http://127.0.0.1:3000;
}
```

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd-reports yourname
sudo nginx -t && sudo systemctl reload nginx
```

### 3.10 Future deploys

After every push to `main`:

```bash
sudo -u definity /var/www/definity/deploy.sh main
```

To roll back:

```bash
ls -1t /var/www/definity/releases/
sudo ln -sfn /var/www/definity/releases/<previous-stamp> /var/www/definity/current
sudo systemctl restart definity
```

---

## 4 · How the data pipelines work

Each pipeline is a separate process, communicating with the website only through files on disk. The website never makes outbound calls on a user request.

### Stats pipeline (hourly)

```
pool-stats.timer ─▶ scripts/fetch-pool-stats.mjs ─▶ public/stats.json
                                                 ─▶ public/validators.json   (≤ 1× / 24h)
                              │
                              │  reads:
                              ▼
                       Solana RPC (mainnet-beta or yours)
                       Stakewiz API (validator geo, daily)

Next.js                ─▶ public/stats.json + public/validators.json
(ISR, 30 min)              read on the homepage render
```

### Analytics pipeline (continuous + daily)

```
Browser ─▶ POST /api/track ─▶ /var/lib/definity/events.jsonl
                              (allowlisted event names only;
                               no cookies; no IP in events file)

daily-report.timer ─▶ scripts/daily-report.mjs ─▶ public/reports/{date,latest}.html
                                              ─▶ public/reports/latest-summary.txt
                                              ─▶ stdout (in journalctl)
                              │
                              │  optionally embeds:
                              ▼
                       goaccess on /var/log/nginx/access.log
```

**Failure modes are all soft:**
- RPC down → script exits non-zero, prior `stats.json` left intact.
- Stakewiz down → stats portion still writes, prior `validators.json` left intact.
- Atomic writes (write-temp + rename) → website never reads a half-written file.
- Website down → timers keep updating files; site recovers with the latest data on restart.

---

## 5 · Security notes

- **Non-custodial.** This site never touches user keys or SOL. Stake actions open Jupiter or Sanctum in a new tab and the user signs in their own wallet on those origins.
- **Strict CSP** in `next.config.js`. Production allows only `*.sanctum.so`, `*.jup.ag`, and `*.typeform.com` as iframe sources, and only `embed.typeform.com` as an external script source. Dev relaxes `'unsafe-eval'` for React Refresh; production stays strict.
- **Hardened systemd units** for both `definity.service`, `pool-stats.service`, and `daily-report.service` (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `RestrictNamespaces`, `MemoryDenyWriteExecute`).
- **First-party analytics.** `/api/track` accepts an allowlisted set of event names (page views + CTAs). No cookies, no fingerprinting, no IP recorded in `events.jsonl`. Host-only referrers (no query strings).
- **No third-party analytics or trackers.** No Google Analytics, no Plausible Cloud, no Mixpanel, etc.
- **No build-time secrets.** Anything sensitive happens client-side, in the user's wallet, on Jupiter / Sanctum / Typeform's origin.

---

## 6 · License

MIT
