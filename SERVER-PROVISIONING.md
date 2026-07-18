# Server-provisioning record — `definity.finance` host (3.107.74.49)

This is a record of everything done on **this specific server** that is *not*
already in `DEPLOY.md`. Two reasons it exists:

1. **Audit trail.** A future-you SSH'd into this box should be able to reconstruct
   why every `/etc/...` file is the way it is.
2. **Backlog for the docs.** Anything in §A or §B below is a candidate for
   merging into `DEPLOY.md` so the next person doesn't rediscover it from scratch.

The bug-fixes I made *to the repo's `deploy/` files* during this install are
tracked separately — see `git status` in the working tree, or the PR description
once that's opened. This file is only about **divergences from `DEPLOY.md` at
the host level**.

---

## 0 · Why this server needed more changes than prior installs

This box is **Ubuntu 26.04 LTS "Resolute Raccoon"** with kernel 7.0.x. That's
a major jump over Ubuntu 22.04 (kernel 5.15) and even 24.04 (kernel 6.8).
Several `deploy/` quirks that would have been invisible on older hosts surface
loudly here:

| Change in this PR | Ubuntu-version-explained? | Why |
|---|---|---|
| Removed `MemoryDenyWriteExecute=true` from systemd units | **Yes — kernel 7.0 enforcement.** Kernel 6.3+ added `prctl(PR_SET_MDWE)` and systemd now uses the prctl path in addition to seccomp. V8's baseline (Sparkplug) JIT trips the strict enforcement and SIGTRAPs on `mprotect(PROT_EXEC)`. On older kernels Node would skate past this. |
| `listen … ssl http2;` → `listen … ssl;` + `http2 on;` | **Yes — nginx 1.28 deprecation.** 22.04 ships nginx 1.18, 24.04 ships 1.24, 26.04 ships 1.28.3 which warns. |
| Inlined SSL settings; dropped `include options-ssl-nginx.conf` and `ssl_dhparam` | **Partly.** Snap certbot 5.5.0 with `--webroot` doesn't ship those files; older snap certbot or `apt install python3-certbot-nginx` would have. |
| Dropped `npm ci --omit=dev=false` | **Partly.** Older npm tolerated invalid flags silently; current npm 10.x warns. Always meaningless. |
| Dropped `ssl_stapling on;` | **No, time-dependent.** LE began issuing E-series intermediates without OCSP responder URLs in mid-2025. Older issuances on prior hosts have R-series certs that still carry OCSP. |
| `deploy.sh` checkout-before-mkdir bug | **No, real bug.** `git --work-tree=NONEXISTENT_PATH` against a bare repo errors on every modern git. Suggests `deploy.sh` was patched in-place on prior hosts and never committed back. |
| `cp -r public` → symlinks; `npm run stats:fetch` before `build` | **No, latent code bug.** Other hosts have the same 30-min "—" window after deploy and same `/reports/` 404, just unnoticed unless you actively check. |
| `location /reports/ { alias … }` in nginx | **No.** Next.js standalone uses a build-time prerender-manifest on every platform; new files in `public/` post-build aren't served until restart. Other hosts have the same issue. |

**Net:** of the 11 changes in this PR, ~4 are genuine Ubuntu-26 portability
fixes, and ~7 are latent code bugs that have always been there. The PR's
commit grouping reflects the split.

---

## A · Persistent host-level changes (still in effect)

### A0a · Notion integration for /api/whitelist

The validator-whitelist form (`/api/whitelist`) writes new pages into the
"Validator Applications" Notion database. Credentials are loaded by systemd
via `EnvironmentFile=` from out-of-repo files:

```bash
# 1. Durable record (chmod 600, root-only). Source of truth — copy from here
#    if either of the EnvironmentFile copies are lost.
sudo cat /root/notion-creds.txt    # holds: NOTION_TOKEN, NOTION_DATABASE_ID

# 2. Per-environment EnvironmentFile reads:
#    /etc/default/definity.env           — prod   (no NOTION_TITLE_PREFIX)
#    /etc/default/definity-staging.env   — staging (NOTION_TITLE_PREFIX=[TEST])
sudo cat /etc/default/definity.env
sudo cat /etc/default/definity-staging.env
```

Both systemd units reference these via `EnvironmentFile=-/etc/default/definity{,-staging}.env`
(the leading dash means: if the file is absent, the service still starts and
`/api/whitelist` falls back to JSONL-only mode). The repo's `deploy/definity{,-staging}.service`
both list the EnvironmentFile path, so a fresh deploy correctly wires the file in.

**Notion integration permissions:** the integration only needs **insert** permission
on the "Validator Applications" database. The endpoint code never reads, updates,
or deletes pages — just creates.

**Per-env behavior:**
- **Prod** writes records with the validator's vote id as the title verbatim (e.g. `VotE1abc…`).
- **Staging** prepends `[TEST] ` so test submissions are obvious in the same DB. The user manually deletes them when reviewing.

**Rotation:** if the integration secret needs rotating:

```bash
# At https://www.notion.so/profile/integrations regenerate, then on the box:
sudo $EDITOR /root/notion-creds.txt
sudo $EDITOR /etc/default/definity.env
sudo $EDITOR /etc/default/definity-staging.env
sudo systemctl restart definity definity-staging
```

**Failure modes (defensive):**
- Notion API unreachable / 5xx → `/api/whitelist` still returns `{ ok: true }` to the user.
- The submission is *always* appended to JSONL on disk *first*. If the disk
  write fails, the API returns 500 (because we then have no durable record);
  if Notion fails, we log and proceed.
- `WHITELIST_LOG_PATH` env var (per-environment) controls where the JSONL is written:
  - prod: `/var/lib/definity/whitelist-applications.jsonl`
  - staging: `/var/lib/definity-staging/whitelist-applications.jsonl`

### A0b · Staging environment (`test.definity.finance`)

A second copy of the site runs on the same box, isolated by port + release tree
+ analytics dir, behind nginx basic auth. Prod and staging share the same
`definity` Linux user (single user keeps sudoers + shared editing simple) and
both build from the **single working tree at `/home/ubuntu/build/definity-website`**.
Prod deploys from `origin/main` (committed code only); staging deploys from
the local working tree (uncommitted ok).

**Per-host setup that is NOT in the repo:**

```bash
# 1. Staging release + data dirs (owned by definity, same as prod).
sudo mkdir -p /var/www/definity-staging /var/lib/definity-staging
sudo chown -R definity:definity /var/www/definity-staging /var/lib/definity-staging

# 2. Extend the existing /etc/sudoers.d/definity-deploy with -staging targets:
echo 'definity ALL=(root) NOPASSWD: /usr/bin/systemctl restart definity, /usr/bin/systemctl status definity, /usr/bin/systemctl start definity, /usr/bin/systemctl stop definity, /usr/bin/systemctl restart definity-staging, /usr/bin/systemctl status definity-staging, /usr/bin/systemctl start definity-staging, /usr/bin/systemctl stop definity-staging' \
    | sudo tee /etc/sudoers.d/definity-deploy >/dev/null
sudo chmod 440 /etc/sudoers.d/definity-deploy
sudo visudo -cf /etc/sudoers.d/definity-deploy

# 3. Install ACL package + grant definity read/traverse on the working tree.
#    Required because /home/ubuntu is 750 by default; deploy.sh staging needs
#    to bundle the local working tree as the definity user.
sudo apt-get install -y acl
sudo setfacl -m u:definity:x /home/ubuntu
sudo setfacl -m u:definity:x /home/ubuntu/build
sudo setfacl -R -m u:definity:rX /home/ubuntu/build/definity-website
sudo setfacl -d -R -m u:definity:rX /home/ubuntu/build/definity-website

# 4. Tell git the working tree is safe to use across user boundaries (otherwise
#    git refuses with "dubious ownership" when definity runs git ls-files there).
sudo git config --system --add safe.directory /home/ubuntu/build/definity-website

# 5. Install the staging systemd unit (committed in deploy/definity-staging.service):
sudo cp /home/ubuntu/build/definity-website/deploy/definity-staging.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable definity-staging.service   # don't start until first deploy

# 6. Basic auth credentials (one-time):
sudo apt-get install -y apache2-utils
STAGING_PW="$(openssl rand -base64 18)"
echo "$STAGING_PW" | sudo htpasswd -ci /etc/nginx/.htpasswd-staging staging
sudo chmod 640 /etc/nginx/.htpasswd-staging
sudo chgrp www-data /etc/nginx/.htpasswd-staging
echo "  username: staging"
echo "  password: $STAGING_PW   # save this somewhere durable"

# 7. First staging deploy (after the deploy.sh + nginx.conf changes from this
#    branch are merged):
sudo -u definity /var/www/definity/deploy.sh staging
```

**Day-to-day deploy commands:**

```bash
# Deploy current working tree (uncommitted ok) to staging:
sudo -u definity /var/www/definity/deploy.sh staging

# Deploy a specific git ref to staging (committed code):
sudo -u definity /var/www/definity/deploy.sh staging some-feature-branch

# Deploy origin/main to prod (committed code only):
sudo -u definity /var/www/definity/deploy.sh prod

# Or the legacy single-arg form, also prod:
sudo -u definity /var/www/definity/deploy.sh
```

**To reset / rotate the staging basic-auth password:** re-run step 6 above.

---



### A1 · Swapfile (2 GiB) + lowered swappiness

`next build` peaks near 900 MB resident on a fresh checkout. This box has 951 MB
RAM, so without swap the build OOMs partway through. Added 2 GiB of swap and
lowered `vm.swappiness` so the kernel still prefers RAM under normal load.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
sudo sysctl -p /etc/sysctl.d/99-swappiness.conf
```

Verify: `free -h` should show 2 GiB of swap.

**Should this be in DEPLOY.md?** Yes, as a conditional step ("if your VPS has
< 2 GB RAM, do this first"). DEPLOY.md TL;DR claims "1 vCPU, 1 GB RAM is plenty"
which is misleading — 1 GB plus swap is plenty; 1 GB without swap is not.

### A2 · Narrow NOPASSWD sudoers grant for the `definity` user

`deploy.sh` ends with `sudo systemctl restart "$SERVICE"`. When the script runs
under `sudo -u definity`, that inner `sudo` blocks on a password because the
`definity` system user has no sudoers entry by default. Added a narrow
NOPASSWD rule that allows *only* lifecycle ops on the `definity` service —
nothing else.

```bash
echo 'definity ALL=(root) NOPASSWD: /usr/bin/systemctl restart definity, /usr/bin/systemctl status definity, /usr/bin/systemctl start definity, /usr/bin/systemctl stop definity' \
    | sudo tee /etc/sudoers.d/definity-deploy >/dev/null
sudo chmod 440 /etc/sudoers.d/definity-deploy
sudo visudo -cf /etc/sudoers.d/definity-deploy   # syntax check
```

**Should this be in DEPLOY.md?** Yes — it's a hard prerequisite for the deploy
script. Without it, the very first deploy hangs at the restart step.

### A3 · Removed nginx default site

The Debian/Ubuntu nginx package ships an enabled "Welcome to nginx!" default
site at `/etc/nginx/sites-enabled/default`. Left in place, it competes with
our `definity` site for the default-server role on port 80 (whichever is
parsed first wins for unmatched server_names). Removed it:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

**Should this be in DEPLOY.md?** Yes — one line in §4 (the bootstrap nginx
step) is enough.

### A4 · AWS Security Group note (informational, no change made)

`ufw` only controls the OS firewall. On EC2, the Security Group is the outer
gate. The user verified manually that this instance's SG allows inbound TCP
80/443 from `0.0.0.0/0`. No automated step on the box.

**Should this be in DEPLOY.md?** Yes — a one-line note in §2 ("if you're on
AWS/GCP/Azure, also open 80+443 in the cloud firewall").

---

## B · Persistent changes worth a follow-up

### B1 · `snap.certbot.renew.timer` is still enabled

The certbot snap package ships its own renewal timer (`snap.certbot.renew.timer`,
fires at 03:19 UTC). It runs `certbot renew --quiet` *without* the
`--deploy-hook 'systemctl reload nginx'` that our `certbot-renew.timer`
(03:34 UTC) provides. Both are idempotent (renewals are no-ops outside the
30-day-to-expiry window) but they overlap.

Recommendation: disable the snap one so only ours fires:

```bash
sudo systemctl disable --now snap.certbot.renew.timer
```

**Should this be in DEPLOY.md?** Yes — note added to §6 (TLS) where the snap
install of certbot happens.

### B2 · Two certs currently exist on the box

| Cert | Issued | Expires | Used by current `nginx.conf`? |
|---|---|---|---|
| `definity.finance` (+ `www`) | 2026-05-03 | 2026-08-01 | ✅ yes |
| `test.definity.finance` | 2026-05-02 | 2026-07-31 | ❌ no — was Phase-A staging |

The test cert is harmless but will keep auto-renewing forever as long as DNS
for `test.definity.finance` still resolves to this box. Two cleanup options
when convenient:

```bash
# Option 1 — delete the cert + renewal config:
sudo certbot delete --cert-name test.definity.finance

# Option 2 — drop the test.definity.finance DNS record at your provider.
# (Once DNS no longer resolves, the next renewal attempt soft-fails and
#  certbot stops trying after a few weeks.)
```

---

## C · One-time deltas (no longer relevant)

These were applied directly to the running box during install but are now
**also fixed in the repo's `deploy/` files**, so a clean redeploy starting
from a fresh `git clone` would reach the same state without these manual
steps. Recorded for historical accuracy only.

| Action | Why it was needed at the time | Now obsolete because |
|---|---|---|
| `rm -rf releases/<failed-stamp>` | First `deploy.sh` run died mid-build because of the checkout-before-mkdir bug | Bug fixed in `deploy.sh` |
| Replaced `.next/standalone/public` and `.next/standalone/.next/static` with symlinks in the live release | `deploy.sh` was `cp -r`'ing them at build time, freezing them | Symlinks now created by `deploy.sh` itself |
| Manually `mkdir`'d `current/public/reports/` and ran `daily-report.service` | New release had no reports dir; daily-report 404'd | Implicitly resolved by the next `daily-report.timer` tick (script `mkdir -p`s) and by the new `/reports/` nginx alias which serves from `current/public/reports/` |
| Manually edited live `/etc/systemd/system/definity.service` to remove `MemoryDenyWriteExecute=true` | V8 JIT crashed with SIGTRAP on every Node start | Removed from `deploy/definity.service` (and the two timer-driven units) in the repo |
| Used `DOMAINS=test.definity.finance ./tls-issue.sh` to issue the staging cert | Wanted to validate the TLS pipeline against a throwaway hostname before risking the production rate limit | Repo's `tls-issue.sh` now reads `DOMAINS` from env (default still `definity.finance + www`) |
| Wrote a temporary HTTPS nginx config for `test.definity.finance` to `/etc/nginx/sites-available/definity` | Repo's `nginx.conf` is wired for prod hostnames | Replaced with `cp deploy/nginx.conf /etc/nginx/sites-available/definity` at Phase B cutover |

---

## D · Quick-look "what user runs what" matrix

| Service | Type | User | Restart-on-crash? | Recovery |
|---|---|---|---|---|
| `definity.service` | `simple` | `definity` | ✅ `Restart=on-failure`, `RestartSec=3` | systemd respawns within ~3s |
| `nginx.service` (master) | `forking` | `root` | ❌ `Restart=no` | manual; consider `systemctl edit` to add `Restart=on-failure` |
| `nginx` (workers) | — | `www-data` | — | nginx master respawns workers |
| `pool-stats.service` | `oneshot` | `definity` | ❌ (not applicable) | next `pool-stats.timer` tick (hourly) |
| `daily-report.service` | `oneshot` | `definity` | ❌ (not applicable) | next `daily-report.timer` tick (02:13 UTC) |
| `certbot-renew.service` | `oneshot` | `root` | ❌ (not applicable) | next `certbot-renew.timer` tick (03:17 + 15:17 UTC) |
| `definity-repwatch.service` | `oneshot` | `definity` | ❌ (not applicable) | next `definity-repwatch.timer` tick (20:05 UTC daily) |

All four timers have `Persistent=yes`/`true` — a missed run during downtime fires
on next boot.

### D1 · Reputation watch (`definity-repwatch`)

Daily VirusTotal + Google Safe Browsing check on `definity.finance`; TG-notifies
only when the vendor verdict set changes (+ a Monday heartbeat). Part of the AV
delisting campaign (see CLAUDE.md's AV-reputation note). Read-only, holds no keys.

- Script: `scripts/definity-reputation-watch.py` (installed to, and run from, `/usr/local/bin/`).
- Units: `deploy/definity-repwatch.{service,timer}`.
- Creds via `EnvironmentFile` (NOT in the repo): `/etc/default/sgdi.env` (TG) + `/etc/default/definity-repwatch.env` (`VT_API_KEY`).
- State: `/var/lib/definity-repwatch/state.json`.

Install / refresh from the repo (this dir is a public GitHub repo — the script + units are secret-free; keys live only in the env files above):

```bash
sudo install -m755 scripts/definity-reputation-watch.py /usr/local/bin/
sudo cp deploy/definity-repwatch.service deploy/definity-repwatch.timer /etc/systemd/system/
sudo install -d -o definity -g definity /var/lib/definity-repwatch
sudo systemctl daemon-reload && sudo systemctl enable --now definity-repwatch.timer
# smoke: sudo -u definity bash -c 'set -a; . /etc/default/sgdi.env; . /etc/default/definity-repwatch.env; set +a; python3 /usr/local/bin/definity-reputation-watch.py --force'
```

The `definity` user has *no* shell, *no* home, and only one sudo grant (see
A2 above). It cannot write outside `/var/www/definity` and `/var/lib/definity`
(enforced by `ProtectSystem=strict` + `ReadWritePaths` in the systemd unit).
