# Operational notes for Claude

This file is read automatically when Claude Code is invoked in this repo. It exists so that a future Claude session (yours, picking up cold) can come up to speed in minutes without re-reading every other doc.

---

## ⚡ CURRENT WORKFLOW (2026-07) — supersedes anything below that conflicts

The sections below this block date from the original definity-website era and are partially stale. What is true NOW:

- **You edit in THIS worktree** (`/home/ubuntu/build/definity-redesign`, branch `redesign/concept-d`), a git worktree of `esterhuizen/definity-website`.
- **The release cycle (enforced by a guard in `deploy/deploy.sh` — do not work around it):**
  1. Discuss the change; implement it here.
  2. `sudo WORKTREE_DIR=/home/ubuntu/build/definity-redesign bash deploy/deploy.sh staging` — bundles the dirty worktree. Test on staging (localhost:5100 + the public staging URL).
  3. Iterate on staging until the user says it's right. Prod is untouched throughout.
  4. On the user's explicit confirmation only: ONE focused clean commit → `git branch -f main HEAD` → `git push origin main redesign/concept-d` → `sudo bash deploy/deploy.sh prod` → verify live with curl.
  - Prod builds from **GitHub `origin/main`** (the bare repo at `/var/www/definity/repo.git` points at GitHub). The guard refuses a prod deploy if tracked changes are uncommitted, main isn't pushed, or staging isn't running the sha being promoted. `FORCE_PROD=1` exists for emergency rollback/hotfix only.
- **Staging-only content:** `src/app/(dark)/direct-staking/comparison/` + `src/app/api/direct-stake/comparison/` are **deliberately untracked** staging-only pages and must never be committed (this repo is public). They reach staging via the worktree bundle; staging release names carry a `-dirty` suffix because of them — that exact dirt is expected, any other is not.
- **test.definity.finance** is Cloudflare-proxied (orange cloud) — never point it (or any subdomain) at the bare AWS IP: bare-IP hosting is what got the domain flagged by AV vendors in 2026-06. Basic auth on staging did NOT prevent reputation flagging (creds live on the box, not here).
- **AV-reputation context:** definity.finance was flagged "malicious/phishing" by ~11 vendors (name collision with Definity Financial Corp + .finance TLD + young domain). A delisting campaign is active; the footer disambiguation line in `FooterD.tsx` and `public/.well-known/security.txt` are part of it — do not remove either.
- **Embed widget:** `src/embed/` builds to `public/embed/v1/widget.js` via `scripts/build-embed.mjs` (runs inside `npm run build`). Partners hotlink it — treat its URL as a public API.
- **Commit trailer:** `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (the trailer named below is outdated).
- **Verification is part of every deploy** — after `deploy.sh prod`, curl the affected page(s) through Cloudflare and confirm the change string is present, and check `stats:fetch` didn't ship an empty `validators.json` (if Stakewiz was down, seed from the prior release and restart).

**Doc map** — read in this order if you're starting fresh:
1. **This file (CLAUDE.md)** — operational cheat sheet, run-this-first commands
2. **[SERVER-PROVISIONING.md](./SERVER-PROVISIONING.md)** — what's been done to the live box that is NOT in DEPLOY.md (swap, sudoers, ACLs, MDWE removal, staging env, basic-auth credentials location)
3. **[README.md](./README.md)** — what the project is, stack overview, security posture
4. **[DEPLOY.md](./DEPLOY.md)** — first-time install on a fresh Ubuntu/Debian box (mostly historical now — the prod box is already set up)

---

## Run these first to orient yourself

If you've just started a session and don't know what the box looks like, copy-paste this block. It takes ~5 seconds and answers everything you need to know before touching anything.

```bash
# 1. Where am I? (live host vs anywhere else)
test -d /var/www/definity/current && echo "ON THE LIVE HOST" || echo "DEV / OTHER"
hostname && uname -a && lsb_release -d 2>/dev/null

# 2. What's running? (5 services + 3 timers expected)
systemctl is-active definity definity-staging nginx \
                    pool-stats.timer daily-report.timer certbot-renew.timer

# 3. Recent deploys (prod + staging)
ls -1t /var/www/definity/releases/         | head -3
ls -1t /var/www/definity-staging/releases/ | head -3 2>/dev/null

# 4. Source-tree state (the canonical working tree both prod + staging build from)
cd /home/ubuntu/build/definity-website && git status --short && git branch --show-current
gh pr list --state open

# 5. Health probes (no auth needed for prod; staging needs basic auth)
curl -sS -o /dev/null -w "prod  %{http_code}  HTTP/%{http_version}\n" https://definity.finance/
curl -sS -o /dev/null -w "staging %{http_code} (auth-gated)\n"        https://test.definity.finance/

# 6. Recent journal (last 30 lines per service)
journalctl -u definity         --no-pager -n 20
journalctl -u definity-staging --no-pager -n 20
```

If any of those produce surprises, **read SERVER-PROVISIONING.md before changing anything** — there are several non-obvious things on the box (swap, sudoers, ACLs, MDWE removal, basic-auth file location) that DEPLOY.md doesn't cover but matter operationally.

---

## First, figure out where you are

Behaviour differs between **the live host** (which runs both prod and staging) and **anywhere else** (dev laptop, fresh worktree, etc.). The detection from §1 above is the answer; expanded cases:

| Path that exists | Means |
|---|---|
| `/var/www/definity/current/` | You're on the live host. Both prod (`definity.service`, port 3000, `definity.finance`) and staging (`definity-staging.service`, port 5100, `test.definity.finance`) run here. |
| `/home/ubuntu/build/definity-website/` (only) | You're on the live host's source-tree shell (or a dev box that mirrors it). The working tree here is the canonical one — `deploy.sh staging` bundles it as-is. |
| Neither | You're on a dev box. Use `npm run dev` for local iteration; you'll have to git-push and SSH to the live host for any deployment. |

---

## ⚠ This is a PUBLIC GitHub repo

`https://github.com/esterhuizen/definity-website` is public. **Never put secrets in any tracked file** — passwords, TLS private keys, API tokens, basic-auth plaintexts, anything sensitive. Use `/root/<service>-creds.txt` (chmod 600, root-only) on the live host instead, and reference the file path from repo docs. See "Where credentials live" below.

---

## Project at a glance

- **Stack:** Next.js 15 (App Router) → standalone bundle, served by `node` behind nginx. Self-hosted, no PaaS.
- **Two environments on one host** (both `definity` user, both reachable via nginx by hostname):
  | | Prod | Staging |
  |---|---|---|
  | Hostname | `definity.finance` + `www` | `test.definity.finance` (basic-auth gated) |
  | Port | 3000 | 5100 |
  | systemd unit | `definity.service` | `definity-staging.service` |
  | Release tree | `/var/www/definity/` | `/var/www/definity-staging/` |
  | Analytics | `/var/lib/definity/events.jsonl` | `/var/lib/definity-staging/events.jsonl` |
  | Source for deploys | `origin/main` (committed only) | local working tree (uncommitted ok) |
  | Timers | pool-stats + daily-report + certbot-renew | none (uses build-time stats:fetch) |
- **Single source-of-truth working tree** at `/home/ubuntu/build/definity-website/`. Both prod and staging deploys build FROM there. You edit code in one place.
- **Data sources (prod):**
  - On-chain pool state (Solana mainnet RPC) — pulled hourly into `public/stats.json`.
  - Stakewiz API — pulled at most once per day into `public/validators.json` (validator geo).
  - First-party events from `/api/track` — appended to `/var/lib/definity/events.jsonl`.
- **Three systemd timers run independently of the website process (prod only):**
  | Unit | Cadence | What it does |
  |---|---|---|
  | `pool-stats.timer` | hourly | runs `scripts/fetch-pool-stats.mjs` → writes `stats.json`, refreshes `validators.json` once / 24h |
  | `daily-report.timer` | daily 02:13 UTC | runs `scripts/daily-report.mjs` → writes `public/reports/{YYYY-MM-DD,latest}.html` |
  | `certbot-renew.timer` | twice daily | runs `/usr/local/sbin/tls-renew.sh` → renews + reloads nginx if a cert was replaced (renews ALL certs on the box, including the staging cert) |
- **Communication is by file on disk** between every moving piece. If the website crashes, the timers keep updating files. If the timers crash, the website keeps serving the last known-good files.

---

## The day-to-day deploy workflow

```bash
# 1. Edit code in /home/ubuntu/build/definity-website/

# 2. Push the local working tree (uncommitted ok) to staging:
sudo -u definity /var/www/definity/deploy.sh staging

# 3. Visit https://test.definity.finance/ with the basic-auth creds
#    (creds at /root/staging-creds.txt — sudo cat to read) and verify

# 4. When happy, commit + push:
git add . && git commit -m "..." && git push

# 5. Promote to prod (origin/main only, never WIP):
sudo -u definity /var/www/definity/deploy.sh prod
```

**Never `deploy.sh prod` uncommitted code** — `prod` always pulls `origin/main` from GitHub. If you need to test against prod's runtime topology, use `staging` first.

---

## Production cheat sheet

All commands assume you're on the prod server.

### Deploy latest from `main`

```bash
sudo -u definity /var/www/definity/deploy.sh prod
# or, equivalently (legacy single-arg form):
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
journalctl -u definity         -f          # prod app
journalctl -u definity-staging -f          # staging app
journalctl -u pool-stats       -n 100      # hourly stats (prod)
journalctl -u daily-report     -n 100      # daily aggregator (prod)
journalctl -u certbot-renew    -n 100      # cert renewals (both certs)
sudo tail -F /var/log/nginx/{access,error}.log
```

---

## Staging cheat sheet

```bash
# Deploy from local working tree (uncommitted ok):
sudo -u definity /var/www/definity/deploy.sh staging

# Deploy a specific git ref (e.g. a PR branch) to staging:
sudo -u definity /var/www/definity/deploy.sh staging some-feature-branch

# Health
systemctl status definity-staging
journalctl -u definity-staging -f
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5100/   # bypass nginx + auth

# External (need basic auth — creds at /root/staging-creds.txt):
sudo cat /root/staging-creds.txt    # one-liner: get the password
curl -u staging:'<password>' https://test.definity.finance/
```

Staging-specific facts worth remembering:
- Staging cert at `/etc/letsencrypt/live/test.definity.finance/` is renewed by the same `certbot-renew.timer` that handles prod.
- Staging has NO `pool-stats` / `daily-report` timers — `stats:fetch` runs at build time so stats are fresh-at-deploy.
- Staging analytics events go to `/var/lib/definity-staging/events.jsonl` (separate from prod).
- Staging robots.txt is overridden at the nginx layer to `Disallow: /` so even authenticated crawlers don't index it. `X-Robots-Tag: noindex, nofollow, nosnippet, noarchive` is also set on every staging response.
- The staging deploy script can read the working tree at `/home/ubuntu/build/definity-website/` because of an ACL grant + `git config --system safe.directory` (see SERVER-PROVISIONING.md A0). If `deploy.sh staging` ever errors with permission denied or "dubious ownership", check those.

---

## Where credentials live (live host only — NOT in repo)

| What | Where on the box | Notes |
|---|---|---|
| Staging basic-auth password | `/root/staging-creds.txt` (chmod 600) | `sudo cat` to read. Rotate via the snippet inside the file. |
| Staging basic-auth hash | `/etc/nginx/.htpasswd-staging` (chmod 640, www-data group) | bcrypt hash, served by nginx. Regenerate with `htpasswd -ci`. |
| **Notion integration token + database ID** | **`/root/notion-creds.txt`** (chmod 600) | Source of truth. Used by `/api/whitelist` to write into "Validator Applications" DB. |
| Notion creds — prod systemd | `/etc/default/definity.env` (chmod 600) | Loaded by `definity.service` via `EnvironmentFile=`. |
| Notion creds — staging systemd | `/etc/default/definity-staging.env` (chmod 600) | Loaded by `definity-staging.service`. Includes `NOTION_TITLE_PREFIX=[TEST]` so staging records are marked. |
| TLS certs (prod + staging) | `/etc/letsencrypt/live/{definity.finance,test.definity.finance}/` | Auto-renewed by `certbot-renew.timer`. |
| Sudoers grant for `definity` user | `/etc/sudoers.d/definity-deploy` | NOPASSWD restricted to `systemctl restart\|status\|start\|stop` of `definity` and `definity-staging`. Edit via `sudo visudo -f`. |
| ACL grants for `definity` to read working tree | `/home/ubuntu`, `/home/ubuntu/build`, `/home/ubuntu/build/definity-website` | Inspect with `getfacl <path>`. Re-grant from SERVER-PROVISIONING.md A0 if it ever falls out. |

The Notion integration is the only third-party API token in use. Solana mainnet RPC is public, Stakewiz is unauthenticated, no other external services are wired in.

---

## Where stuff lives on the production server

```
/home/ubuntu/build/definity-website/   # canonical source tree (you edit here)
                                       # — both prod + staging deploys build from this

/var/www/definity/                     # PROD release tree
├── current               -> releases/<stamp>
├── releases/             # last 3 prod builds (atomic deploy keeps these)
├── repo.git/             # bare clone for fast deploys (origin/main)
└── deploy.sh             # canonical deploy script (handles both targets)

/var/www/definity-staging/             # STAGING release tree
├── current               -> releases/<stamp>
└── releases/             # last 3 staging builds (working-tree mode → no repo.git/)

/var/lib/definity/
└── events.jsonl          # PROD first-party analytics
/var/lib/definity-staging/
└── events.jsonl          # STAGING analytics (isolated from prod)

/var/log/nginx/
├── access.log            # combined-format; goaccess reads this
└── error.log

/etc/letsencrypt/live/
├── definity.finance/{fullchain,privkey}.pem      # prod cert
└── test.definity.finance/{fullchain,privkey}.pem # staging cert (auto-renewed too)

/etc/nginx/
├── sites-available/definity         # both server blocks live here (prod + staging)
├── conf.d/definity-ratelimit.conf
├── .htpasswd-staging                # bcrypt hash for staging basic auth
└── (the staging password plaintext is at /root/staging-creds.txt — see "Where credentials live")

/etc/systemd/system/
├── definity.service                # prod website
├── definity-staging.service        # staging website
├── pool-stats.{service,timer}      # hourly on-chain refresh (prod only)
├── daily-report.{service,timer}    # nightly aggregator (prod only)
└── certbot-renew.{service,timer}   # twice-daily TLS renewal (handles BOTH certs)

/etc/sudoers.d/
└── definity-deploy                 # NOPASSWD systemctl restart/status/start/stop
                                    # for both definity and definity-staging

/usr/local/sbin/
└── tls-renew.sh                    # called by certbot-renew.service

/swapfile                           # 2 GiB swap (required — 951 MB RAM ceiling)
                                    # see SERVER-PROVISIONING.md A1
```

Both website units (`definity.service` and `definity-staging.service`) are hardened with `ProtectSystem=strict`. Each lists ONLY its own `ReadWritePaths` (prod can write to `/var/www/definity` + `/var/lib/definity`; staging to `/var/www/definity-staging` + `/var/lib/definity-staging`). Even though they share the `definity` Linux user, they cannot touch each other's release dirs or analytics.

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
- **Don't deploy uncommitted code to prod.** `deploy.sh prod` always pulls from `origin/main`. Use `deploy.sh staging` (which uses the local working tree) for any WIP test.
- **Don't `npm install` directly under `/var/www/definity/current/`** (or the staging equivalent). The `current` symlink can flip mid-install and `npm` will trash an old release. Use `deploy.sh`, which builds in a stamp dir then swaps.
- **Don't edit files inside `releases/<stamp>/`** by hand. Make the change in `/home/ubuntu/build/definity-website/`, then `deploy.sh staging` or `deploy.sh prod`.
- **Don't disable hardening in `definity.service` or `definity-staging.service`** (`NoNewPrivileges`, `ProtectSystem=strict`, `ReadWritePaths`, etc.) without a clear reason. They are precisely what keeps staging from being able to write into prod's release dirs.
- **Don't re-enable `MemoryDenyWriteExecute=true` in any of the systemd units.** It SIGTRAPs Node on V8 baseline-compile. See SERVER-PROVISIONING.md §0.
- **Don't expose `/reports/` publicly on prod.** It contains traffic data; protect with nginx basic auth as documented in `DEPLOY.md` §3.9. (On staging, the entire site is already basic-auth gated.)
- **Don't disable basic auth on staging.** It's the only thing keeping URL-reputation classifiers (Bitdefender et al.) from seeing the test URL and miscategorising it, AND keeps Google from indexing test pages above prod.
- **Don't commit secrets to this repo — IT IS PUBLIC.** No `.env`, no API keys, no basic-auth plaintexts, no TLS private keys. The staging basic-auth password lives at `/root/staging-creds.txt` on the box only. Generated JSON (`stats.json`, `validators.json`, `reports/*`) and `.claude/settings.local.json` are all gitignored — don't override.
- **Don't issue more LE certs than necessary.** Production rate limit is 5 dups per registered domain per week. We already have certs for `definity.finance + www` and `test.definity.finance` — both auto-renew. Use `tls-issue.sh` only for genuinely new hostnames.
- **Don't bump major versions** (Next 15 → 16, React 19 → 20, etc.) on the live server in passing. Test on staging first (the whole point of the staging environment); even then, prefer to ship in a reviewable PR.

---

## When things go wrong — first three things to check

1. **Is the website service running?** `systemctl status definity`. If not, `journalctl -u definity -n 200`.
2. **Is the latest deploy bundle present?** `ls -la /var/www/definity/current/.next/standalone/server.js`. If missing, the last deploy failed mid-flight; re-run `deploy.sh`.
3. **Is nginx healthy + reaching the upstream?** `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/` (bypassing nginx). If 200 here but not via the public URL, nginx config or TLS is the issue.

If validator stats look frozen on the homepage: `journalctl -u pool-stats.service -n 30`. The script soft-fails — a public RPC blip leaves the prior `stats.json` intact, which the website keeps serving. That's the design.

---

## Pointers

- [SERVER-PROVISIONING.md](./SERVER-PROVISIONING.md) — **READ THIS BEFORE TOUCHING THE BOX.** Documents everything done to the live host beyond DEPLOY.md (Ubuntu-26 quirks, MDWE removal, swap, sudoers, ACLs, staging stand-up, basic-auth credential storage path).
- [DEPLOY.md](./DEPLOY.md) — full first-time install on a fresh Ubuntu/Debian box. Mostly historical now (the prod box is already set up); useful as a reference if you ever rebuild from scratch.
- [README.md](./README.md) — what the project is, stack overview, security posture.
- [`src/config/pool.ts`](./src/config/pool.ts) — pool addresses + outbound URLs (single source of truth).
- [`src/app/api/track/route.ts`](./src/app/api/track/route.ts) — what events are allowed.
- [`scripts/`](./scripts) — every periodic job is a Node script with no npm deps.
- [`deploy/`](./deploy) — every systemd unit (prod + staging), nginx config, TLS script, deploy.sh.

If a file doesn't exist where this doc says it does, this doc is wrong — fix it.
