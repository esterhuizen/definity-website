# Deploying Definity on a Linux server

This site is built as a self-contained Next.js standalone bundle. No managed PaaS — just Node, nginx, systemd, and certbot. Two paths below: bare-metal (recommended for debuggability) and Docker.

---

## TL;DR

1. Provision a small VPS (1 vCPU, 1 GB RAM is plenty). Ubuntu 22.04+ or Debian 12.
2. Point `definity.finance` and `www.definity.finance` DNS at it.
3. Run the bare-metal install below, once.
4. Future deploys: `cd /var/www/definity && ./deploy.sh`.

Optional but recommended: put **Cloudflare** (free tier) in front of the server for DDoS protection and global CDN.

---

## Path A — Bare-metal install (recommended)

### 1. System packages

```bash
sudo apt update
sudo apt install -y curl ca-certificates git nginx ufw

# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# certbot via snap (most-current path on Ubuntu/Debian)
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
```

### 2. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 3. App user + directories

```bash
sudo useradd --system --shell /usr/sbin/nologin --home-dir /var/www/definity definity
sudo mkdir -p /var/www/definity
sudo chown -R definity:definity /var/www/definity
```

### 4. Drop in the systemd unit and a bootstrap nginx config

The full nginx config references TLS cert files that don't exist yet, so we install
a **bootstrap** config first (HTTP only, with the ACME challenge path open). After
the cert is issued in step 6, we swap to the full config.

```bash
sudo cp deploy/definity.service        /etc/systemd/system/definity.service
sudo cp deploy/nginx-bootstrap.conf    /etc/nginx/sites-available/definity
sudo cp deploy/nginx-ratelimit.conf    /etc/nginx/conf.d/definity-ratelimit.conf
sudo ln -sf /etc/nginx/sites-available/definity /etc/nginx/sites-enabled/definity
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx
```

### 5. First-time deploy

```bash
sudo -u definity cp deploy/deploy.sh /var/www/definity/deploy.sh
sudo chmod +x /var/www/definity/deploy.sh
sudo -u definity /var/www/definity/deploy.sh main
```

This clones the repo, builds it, and produces `/var/www/definity/current/.next/standalone/server.js`.

### 6. TLS certificate (HTTPS)

This step issues a Let's Encrypt cert for `definity.finance` + `www.definity.finance`
using the **webroot** challenge — no nginx-config rewriting magic, fully scriptable,
and easy to debug.

**Pre-flight:** confirm DNS is correct.

```bash
dig +short definity.finance         # must return your server IP
dig +short www.definity.finance     # must also return your server IP
```

**Rehearse first** (Let's Encrypt rate-limits real issuances; staging does not):

```bash
sudo DRY_RUN=1 deploy/tls-issue.sh
```

If the dry run reports success, issue the real cert:

```bash
sudo deploy/tls-issue.sh
```

The script will:

1. Verify it can serve a token at `http://definity.finance/.well-known/acme-challenge/...`
   (catches 90% of TLS-issuance bugs before talking to Let's Encrypt).
2. Run `certbot certonly --webroot` with a 4096-bit RSA key.
3. Print the next-step commands when it succeeds.

**Swap to the full HTTPS nginx config** (now that certs exist):

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/definity
sudo nginx -t && sudo systemctl reload nginx
```

**Wire up automatic renewal** — uses a systemd timer that fires twice a day with
randomized delay; reloads nginx only when a cert was actually replaced.

```bash
sudo cp deploy/tls-renew.sh           /usr/local/sbin/tls-renew.sh
sudo chmod +x                         /usr/local/sbin/tls-renew.sh
sudo cp deploy/certbot-renew.service  /etc/systemd/system/
sudo cp deploy/certbot-renew.timer    /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now certbot-renew.timer
systemctl list-timers certbot-renew.timer    # confirm next-run time
```

**Test the renewal pipeline without touching the live cert:**

```bash
sudo /usr/local/sbin/tls-renew.sh --dry-run
```

**Inspect logs:**

```bash
journalctl -u certbot-renew.service -n 100
```

**Manual renew** (if you ever need to force one):

```bash
sudo /usr/local/sbin/tls-renew.sh
```

### 7. Start the service

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now definity
sudo systemctl status definity     # should be active (running)
sudo nginx -t && sudo systemctl reload nginx
```

Visit `https://definity.finance` — you should see the site.

### 8. Live pool stats pipeline

The homepage shows two live numbers — **validator count** and **total SOL staked** —
fetched directly from on-chain. The fetcher runs hourly, writes `public/stats.json`,
and the website reads that file on each render (ISR, 30-min cache window). No
remote calls happen on user requests.

```bash
sudo cp deploy/pool-stats.service /etc/systemd/system/
sudo cp deploy/pool-stats.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pool-stats.timer

# Force a first run so the file exists immediately:
sudo systemctl start pool-stats.service

# Sanity check:
sudo cat /var/www/definity/current/public/stats.json
journalctl -u pool-stats.service -n 20
```

If you outgrow the public mainnet-beta RPC (which is rate-limited but more than
enough for one hourly call), edit `pool-stats.service` to set
`Environment=SOLANA_RPC=https://your.private.rpc`.

### 9. Future deploys

After every push to `main`:

```bash
sudo -u definity /var/www/definity/deploy.sh main
```

The script does an atomic symlink swap and `systemctl restart definity`. Old releases are kept for one-command rollback:

```bash
sudo ln -sfn /var/www/definity/releases/<previous-release> /var/www/definity/current
sudo systemctl restart definity
```

---

## Path B — Docker

If you'd rather containerize:

```bash
docker build -t definity-website .
docker run -d --name definity \
  -p 127.0.0.1:3000:3000 \
  --restart unless-stopped \
  definity-website
```

Then point nginx at `127.0.0.1:3000` exactly the same way.

---

## Logs and debugging

```bash
journalctl -u definity -f          # live tail of the app
sudo tail -f /var/log/nginx/error.log
sudo systemctl status definity
```

If the site renders blank, 99% of the time it's one of:

1. **Wrong DNS** — `dig definity.finance` should return your server IP.
2. **certbot didn't run** — `curl -I https://definity.finance` should return `200`, not a TLS error.
3. **Service crashed** — `journalctl -u definity -n 100`.
4. **CSP blocking the Sanctum iframe** — check the browser console. The CSP allows `app.sanctum.so` and `*.sanctum.so` by default; if Sanctum changes their domain, update `next.config.js` `frame-src`.

---

## What's deliberately not here

- No Vercel / Netlify / CDN-edge dependencies.
- No external analytics by default (drop in Plausible self-hosted if you want).
- No Vercel-specific runtime APIs anywhere in the code.
- No build-time secrets — everything sensitive happens client-side, in the user's wallet, inside the Sanctum iframe.

This means: if your server can run `node`, this site can run.
