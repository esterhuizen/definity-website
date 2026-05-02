#!/usr/bin/env bash
# Renew Let's Encrypt certs and reload nginx if anything was actually renewed.
# Designed to be run by the certbot-renew.timer (twice a day with random delay).
#
# Manual run / debug:
#   sudo /usr/local/sbin/tls-renew.sh
#   sudo /usr/local/sbin/tls-renew.sh --dry-run     # rehearse without touching live certs
#
# Logs land in journalctl: `journalctl -u certbot-renew.service -n 200`.

set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: must run as root" >&2
    exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
    echo "ERROR: certbot not installed" >&2
    exit 1
fi

# `certbot renew` is a no-op for certs that aren't within 30 days of expiry.
# `--deploy-hook` runs only when a cert is actually renewed — so nginx reloads
# only when there's a new cert to pick up. No reload, no downtime, on every run.
DEPLOY_HOOK='systemctl reload nginx'

ARGS=(renew --quiet --deploy-hook "$DEPLOY_HOOK")
[[ "$DRY_RUN" == "1" ]] && ARGS+=(--dry-run)

echo "==> Running: certbot ${ARGS[*]}"
certbot "${ARGS[@]}"
echo "==> Done"

# Sanity check after renewal: report days until expiry of the live cert.
LIVE_CERT="/etc/letsencrypt/live/definity.finance/fullchain.pem"
if [[ -f "$LIVE_CERT" ]]; then
    EXPIRY="$(openssl x509 -enddate -noout -in "$LIVE_CERT" | cut -d= -f2)"
    EXPIRY_EPOCH="$(date -d "$EXPIRY" +%s)"
    NOW_EPOCH="$(date +%s)"
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    echo "==> definity.finance cert expires in ${DAYS_LEFT} days (${EXPIRY})"
fi
