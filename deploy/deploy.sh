#!/usr/bin/env bash
# Atomic deploy script for definity website.
#
# Usage: run on the production server, as the `definity` user (or root via sudo -u definity).
#   ./deploy.sh                  # builds the latest from origin/main and switches the symlink
#   ./deploy.sh <git-ref>        # build a specific branch/tag/SHA
#
# Layout it produces:
#   /var/www/definity/
#   ├── current -> releases/2026-05-02-101530-abc1234
#   ├── releases/
#   │   ├── 2026-05-02-101530-abc1234/
#   │   └── 2026-05-01-220115-9f3c2a1/
#   └── repo.git           # bare clone for fast fetches

set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/definity}"
REPO_URL="${REPO_URL:-https://github.com/esterhuizen/definity-website.git}"
SERVICE="${SERVICE:-definity}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
REF="${1:-main}"

mkdir -p "$APP_ROOT/releases"

# bare repo cache (faster than full clone every deploy)
if [ ! -d "$APP_ROOT/repo.git" ]; then
  git clone --bare "$REPO_URL" "$APP_ROOT/repo.git"
fi
git --git-dir="$APP_ROOT/repo.git" fetch --prune origin '+refs/heads/*:refs/heads/*'

SHA="$(git --git-dir="$APP_ROOT/repo.git" rev-parse "$REF" | cut -c1-7)"
STAMP="$(date -u +%Y-%m-%d-%H%M%S)"
RELEASE="$APP_ROOT/releases/$STAMP-$SHA"

echo "==> Building release $STAMP-$SHA from ref $REF"
mkdir -p "$RELEASE"
git --git-dir="$APP_ROOT/repo.git" archive "$REF" | tar -x -C "$RELEASE"

cd "$RELEASE"
npm ci
# Populate public/stats.json + public/validators.json before build so the
# build-time prerender has live data (otherwise the homepage shows '—' for
# the first 30 min until ISR fires).
npm run stats:fetch || echo "WARN: stats:fetch failed; build will use placeholders"
npm run build

# next standalone needs ./public and ./.next/static colocated next to server.js.
# Symlink (not copy) so the timer-written files (stats.json, validators.json,
# reports/*.html) are immediately visible to the standalone server without a redeploy.
rm -rf ".next/standalone/public" ".next/standalone/.next/static"
ln -s ../../public ".next/standalone/public"
ln -s ../../static ".next/standalone/.next/static"

# atomic symlink swap
ln -sfn "$RELEASE" "$APP_ROOT/current.new"
mv -Tf "$APP_ROOT/current.new" "$APP_ROOT/current"

echo "==> Reloading service: $SERVICE"
sudo systemctl restart "$SERVICE"

# prune old releases
cd "$APP_ROOT/releases"
ls -1tr | head -n -"$KEEP_RELEASES" | xargs -r rm -rf

echo "==> Deployed $RELEASE"
