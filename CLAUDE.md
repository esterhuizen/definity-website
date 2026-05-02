# Operational notes for Claude

This file is read automatically when Claude Code is invoked in this repo. It exists so that future you (running on a developer laptop *or* SSH'd into the production server) can act sensibly without re-reading every other doc.

For first-time install steps, read [DEPLOY.md](./DEPLOY.md). For what the project is, read [README.md](./README.md). This file is for **operations** — what to run, where things live, what to avoid.

---

## First, figure out where you are

Behaviour differs between **local dev** and the **live server**. Detect which before doing anything:

```bash
# Are we on the prod box?
test -d /var/www/definity/current && echo PROD || echo DEV

# Hostname / OS sanity:
hostname && uname -a
```

Most diagnostic commands below assume **prod**. If you're in dev, the analogues are noted at the bottom.

---

## Project at a glance

- **Stack:** Next.js 15 (App Router) → standalone bundle, served by `node` behind nginx. Self-hosted, no PaaS.
- **Data sources:**
  - On-chain pool state (Solana mainnet RPC) — pulled hourly into `public/stats.json`.
  - Stakewiz API — pulled at most once per day into `public/validators.json` (validator geo).
  - First-party events from `/api/track` — appended to `/var/lib/definity/events.jsonl`.
- **Three systemd timers run independently of the website process:**
  | Unit | Cadence | What it does |
  |---|---|---|
  | `pool-stats.timer` | hourly | runs `scripts/fetch-pool-stats.mjs` → writes `stats.json`, refreshes `validators.json` once / 24h |
  | `daily-report.timer` | daily 02:13 UTC | runs `scripts/daily-report.mjs` → writes `public/reports/{YYYY-MM-DD,latest}.html` |
  | `certbot-renew.timer` | twice daily | runs `/usr/local/sbin/tls-renew.sh` → renews + reloads nginx if a cert was replaced |
- **Communication is by file on disk** between every moving piece. If the website crashes, the timers keep updating files. If the timers crash, the website keeps serving the last known-good files.

---

## Production cheat sheet

All commands assume you're on the prod server.

### Deploy latest from `main`

```bash
sudo -u definity /var/www/definity/deploy.sh main
```

This atomically symlink-swaps `/var/www/definity/current/` to a fresh build and restarts the website service. It keeps the last 3 releases in `/var/www/definity/releases/`. **Never** edit files under `current/` directly — they get blown away on next deploy.

### Roll back to the previous release

```bash
ls -1t /var/www/definity/releases/        # newest first
sudo ln -sfn /var/www/definity/releases/<previous-stamp> /var/www/definity/current
sudo systemctl restart definity
```

### Health check

```bash
systemctl status definity
journalctl -u definity -n 100 --no-pager
curl -sS -o /dev/null -w "%{http_code}\n" https://definity.finance/
```

### Force-refresh on-chain stats now

```bash
sudo systemctl start pool-stats.service
journalctl -u pool-stats.service -n 30 --no-pager
sudo cat /var/www/definity/current/public/stats.json
```

### Force-refresh validator geo (resets the 24h TTL? no — see note)

The script refuses to call Stakewiz if `validators.json` is younger than 24h. To force a refresh, delete it first:

```bash
sudo rm /var/www/definity/current/public/validators.json
sudo systemctl start pool-stats.service
```

### Force-generate the daily report

```bash
sudo systemctl start daily-report.service
sudo cat /var/www/definity/current/public/reports/latest-summary.txt
```

For an arbitrary date:

```bash
sudo -u definity bash -c '
  cd /var/www/definity/current
  EVENTS_LOG_PATH=/var/lib/definity/events.jsonl \
  REPORTS_DIR=/var/www/definity/current/public/reports \
  /usr/bin/node scripts/daily-report.mjs 2026-05-01
'
```

### List timers + their next-run times

```bash
systemctl list-timers --all | grep -E "definity|pool-stats|daily-report|certbot-renew"
```

### Renew TLS manually

```bash
sudo /usr/local/sbin/tls-renew.sh                # real
sudo /usr/local/sbin/tls-renew.sh --dry-run      # rehearsal
```

### Reload nginx after editing site config

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Tail logs

```bash
journalctl -u definity         -f          # app
journalctl -u pool-stats       -n 100      # hourly stats
journalctl -u daily-report     -n 100      # daily aggregator
journalctl -u certbot-renew    -n 100      # cert renewals
sudo tail -F /var/log/nginx/{access,error}.log
```

---

## Where stuff lives on the production server

```
/var/www/definity/
├── current               -> releases/<stamp>     # symlink to active build
├── releases/             # last 3 builds (atomic deploy keeps these)
├── repo.git/             # bare clone for fast deploys
└── deploy.sh             # the deploy script

/var/lib/definity/
└── events.jsonl          # first-party analytics events (one JSON per line)

/var/log/nginx/
├── access.log            # combined-format; goaccess reads this
└── error.log

/etc/letsencrypt/live/definity.finance/
├── fullchain.pem
└── privkey.pem

/etc/systemd/system/
├── definity.service              # the website
├── pool-stats.{service,timer}    # hourly on-chain refresh
├── daily-report.{service,timer}  # nightly aggregator
└── certbot-renew.{service,timer} # twice-daily TLS renewal

/usr/local/sbin/
└── tls-renew.sh                  # called by certbot-renew.service
```

The website's hardened systemd unit (`definity.service`) lists `/var/www/definity` and `/var/lib/definity` in `ReadWritePaths`. Anywhere else on disk is read-only to that process.

---

## Local dev cheat sheet

```bash
npm install                          # one-time
npm run dev                          # http://localhost:3000 (or 3137 in this WSL setup)
npm run build                        # production bundle into .next/standalone/
npm run start                        # run the built bundle
npm run typecheck
npm run lint
npm run stats:fetch                  # populate public/stats.json + validators.json from live mainnet
EVENTS_LOG_PATH=./events.jsonl npm run dev    # local-writable events file (see .env.example)
```

To smoke-test the daily report locally:

```bash
EVENTS_LOG_PATH=/tmp/events.jsonl REPORTS_DIR=/tmp/reports \
  node scripts/daily-report.mjs 2026-05-02
ls -la /tmp/reports/
```

---

## Conventions worth following

- **Backups before non-trivial edits.** Per the user's global preference, `cp foo foo.bak` before editing tracked files; clean the `.bak` up afterwards. Already in `.gitignore`.
- **Commit messages.** Short subject + free-form body that explains *why*. Co-author trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **One source of truth for pool addresses + URLs:** `src/config/pool.ts`. Never hard-code an address in a component.
- **Generated JSON files are gitignored:** `public/stats.json`, `public/validators.json`, `public/reports/**`, `events.jsonl`. Don't commit them, don't fabricate them — generate by running the relevant script.
- **CSP lives in `next.config.js`.** Production stays strict; dev relaxes `'unsafe-eval'` only for React Refresh. Any new third-party origin (script / iframe) needs an entry in `script-src` / `frame-src`. Test with `curl -I` after editing.
- **Tracking events are allowlisted.** Adding a new event name? Update `ALLOWED_EVENTS` in `src/app/api/track/route.ts`. Adding a new tracked link? Use `<TrackedLink event="…">`, not a raw `<a onClick>`.

---

## DO NOT

- **Don't `git push --force`** to `main`. The deploy script clones from `main`; force-pushing would scramble future deploys' history.
- **Don't `npm install` directly under `/var/www/definity/current/`.** The current symlink can flip mid-install, and `npm` will trash an old release. Use `deploy.sh`, which builds in a stamp dir then swaps.
- **Don't edit files inside `releases/<stamp>/`** by hand. Make the change in git → `deploy.sh main`.
- **Don't disable hardening in `definity.service`** (`NoNewPrivileges`, `ProtectSystem=strict`, etc.) without a clear reason. The site has no business writing outside `/var/www/definity` and `/var/lib/definity`.
- **Don't expose `/reports/` publicly.** It contains traffic data; protect with nginx basic auth as documented in `DEPLOY.md` step 9.
- **Don't commit secrets** — `.env`, `.env.local`, anything with credentials, `.claude/settings.local.json`, generated JSON. All gitignored already; don't override.
- **Don't bump major versions** (Next 15 → 16, React 19 → 20, etc.) on the live server in passing. Run the scheduled monthly maintenance routine (`trig_0173pLX63SKFRg6UMoqFsMX7`) which opens a PR for review.

---

## When things go wrong — first three things to check

1. **Is the website service running?** `systemctl status definity`. If not, `journalctl -u definity -n 200`.
2. **Is the latest deploy bundle present?** `ls -la /var/www/definity/current/.next/standalone/server.js`. If missing, the last deploy failed mid-flight; re-run `deploy.sh`.
3. **Is nginx healthy + reaching the upstream?** `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/` (bypassing nginx). If 200 here but not via the public URL, nginx config or TLS is the issue.

If validator stats look frozen on the homepage: `journalctl -u pool-stats.service -n 30`. The script soft-fails — a public RPC blip leaves the prior `stats.json` intact, which the website keeps serving. That's the design.

---

## Pointers, not contents

This file is intentionally short. Anything detailed lives in:

- [DEPLOY.md](./DEPLOY.md) — full first-time install on a fresh Ubuntu/Debian box.
- [README.md](./README.md) — what the project is, stack overview, security notes.
- [`src/config/pool.ts`](./src/config/pool.ts) — pool addresses + outbound URLs.
- [`src/app/api/track/route.ts`](./src/app/api/track/route.ts) — what events are allowed.
- [`scripts/`](./scripts) — every periodic job is a Node script with no npm deps.
- [`deploy/`](./deploy) — every systemd unit, nginx config, TLS script.

If a file doesn't exist where this doc says it does, this doc is wrong — fix it.
