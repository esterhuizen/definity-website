#!/usr/bin/env bash
# Issue an initial Let's Encrypt cert for definity.finance using the
# webroot challenge. Run this ONCE, on the production server, after:
#   1. DNS for definity.finance + www.definity.finance points at the box.
#   2. nginx is running with `nginx-bootstrap.conf` (port 80 only).
#   3. certbot is installed (snap recommended; see DEPLOY.md).
#
# Usage:
#   sudo ./tls-issue.sh                          # production
#   sudo DRY_RUN=1 ./tls-issue.sh                # staging (rate-limit-safe rehearsal)
#   sudo EMAIL=t@esterhuizens.org ./tls-issue.sh
#
# After it succeeds, swap the active nginx config to the full one:
#   sudo cp deploy/nginx.conf /etc/nginx/sites-available/definity
#   sudo nginx -t && sudo systemctl reload nginx

set -euo pipefail

# Domains can be overridden via env, e.g.:
#   sudo DOMAINS="test.definity.finance" ./tls-issue.sh
#   sudo DOMAINS="definity.finance www.definity.finance" ./tls-issue.sh
if [[ -n "${DOMAINS:-}" ]]; then
    # shellcheck disable=SC2206
    DOMAINS=(${DOMAINS})
else
    DOMAINS=("definity.finance" "www.definity.finance")
fi
EMAIL="${EMAIL:-t@esterhuizens.org}"
WEBROOT="${WEBROOT:-/var/www/certbot}"
DRY_RUN="${DRY_RUN:-0}"

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: must be run as root (try: sudo ./tls-issue.sh)" >&2
    exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
    echo "ERROR: certbot not found. Install it first:" >&2
    echo "  sudo snap install --classic certbot && sudo ln -sf /snap/bin/certbot /usr/bin/certbot" >&2
    exit 1
fi

if ! systemctl is-active --quiet nginx; then
    echo "ERROR: nginx is not running. Start it first: sudo systemctl start nginx" >&2
    exit 1
fi

mkdir -p "$WEBROOT/.well-known/acme-challenge"
chown -R www-data:www-data "$WEBROOT" 2>/dev/null || true

# Quick sanity check: can we reach our own ACME path locally?
TOKEN="bootstrap-$(date +%s)"
echo "$TOKEN" > "$WEBROOT/.well-known/acme-challenge/$TOKEN"
GOT="$(curl -fsS "http://${DOMAINS[0]}/.well-known/acme-challenge/$TOKEN" || true)"
rm -f "$WEBROOT/.well-known/acme-challenge/$TOKEN"
if [[ "$GOT" != "$TOKEN" ]]; then
    echo "ERROR: webroot challenge path is not reachable over HTTP." >&2
    echo "  Expected: $TOKEN" >&2
    echo "  Got:      $GOT" >&2
    echo "  Check that DNS resolves to this server and that nginx-bootstrap.conf is active." >&2
    exit 1
fi
echo "==> Webroot reachability check passed"

DOMAIN_ARGS=()
for d in "${DOMAINS[@]}"; do DOMAIN_ARGS+=(-d "$d"); done

DRY_FLAG=""
[[ "$DRY_RUN" == "1" ]] && DRY_FLAG="--dry-run"

# shellcheck disable=SC2086
certbot certonly \
    --webroot \
    --webroot-path "$WEBROOT" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --keep-until-expiring \
    --rsa-key-size 4096 \
    $DRY_FLAG \
    "${DOMAIN_ARGS[@]}"

if [[ "$DRY_RUN" == "1" ]]; then
    echo "==> DRY RUN succeeded. Re-run without DRY_RUN=1 to issue the real cert."
    exit 0
fi

CERT_DIR="/etc/letsencrypt/live/${DOMAINS[0]}"
if [[ -L "$CERT_DIR/fullchain.pem" ]]; then
    echo "==> Certificate issued at $CERT_DIR"
    echo
    echo "Next steps:"
    echo "  1. Swap active nginx config:"
    echo "       sudo cp deploy/nginx.conf /etc/nginx/sites-available/definity"
    echo "  2. Test + reload:"
    echo "       sudo nginx -t && sudo systemctl reload nginx"
    echo "  3. Enable automatic renewal:"
    echo "       sudo cp deploy/certbot-renew.service /etc/systemd/system/"
    echo "       sudo cp deploy/certbot-renew.timer   /etc/systemd/system/"
    echo "       sudo cp deploy/tls-renew.sh          /usr/local/sbin/tls-renew.sh"
    echo "       sudo chmod +x /usr/local/sbin/tls-renew.sh"
    echo "       sudo systemctl daemon-reload"
    echo "       sudo systemctl enable --now certbot-renew.timer"
    echo "       systemctl list-timers certbot-renew.timer"
else
    echo "ERROR: cert directory not found at $CERT_DIR after certbot ran." >&2
    exit 1
fi
