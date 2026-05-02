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

### 4. Drop in the systemd unit and nginx config

From this repo:

```bash
sudo cp deploy/definity.service       /etc/systemd/system/definity.service
sudo cp deploy/nginx.conf             /etc/nginx/sites-available/definity
sudo cp deploy/nginx-ratelimit.conf   /etc/nginx/conf.d/definity-ratelimit.conf
sudo ln -sf /etc/nginx/sites-available/definity /etc/nginx/sites-enabled/definity
```

### 5. First-time deploy

```bash
sudo -u definity cp deploy/deploy.sh /var/www/definity/deploy.sh
sudo chmod +x /var/www/definity/deploy.sh
sudo -u definity /var/www/definity/deploy.sh main
```

This clones the repo, builds it, and produces `/var/www/definity/current/.next/standalone/server.js`.

### 6. TLS certificate

Make sure your DNS is pointing at the server first, then:

```bash
sudo certbot --nginx -d definity.finance -d www.definity.finance
```

certbot will edit your nginx config to wire up the cert. The renewal cron runs automatically via the snap.

### 7. Start the service

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now definity
sudo systemctl status definity     # should be active (running)
sudo nginx -t && sudo systemctl reload nginx
```

Visit `https://definity.finance` — you should see the site.

### 8. Future deploys

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
