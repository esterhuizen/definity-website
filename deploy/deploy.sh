#!/usr/bin/env bash
# Atomic deploy script for definity website.
#
# Usage:
#   ./deploy.sh                          # prod, fetches origin/main
#   ./deploy.sh main                     # prod, fetches that ref (legacy syntax)
#   ./deploy.sh prod [<git-ref>]         # prod, fetches that ref (default: main)
#   ./deploy.sh staging                  # STAGING, bundles the LOCAL working tree
#                                        # at $WORKTREE_DIR (uncommitted changes ok)
#   ./deploy.sh staging <git-ref>        # STAGING, fetches that ref from origin
#
# Targets:
#   prod     → /var/www/definity/         → restarts definity.service         (port 3000)
#   staging  → /var/www/definity-staging/ → restarts definity-staging.service (port 5100)
#
# Both targets:
#   - keep the last $KEEP_RELEASES (default 3) builds for one-command rollback
#   - swap atomically via rename of the `current/` symlink
#   - run `npm ci`, `npm run stats:fetch`, `npm run build`, then restart
#
# Layout produced (per target):
#   <APP_ROOT>/
#   ├── current -> releases/<stamp>-<sha-or-tag>
#   ├── releases/
#   └── repo.git              # bare clone (only when sourcing from git)

set -euo pipefail

# ─── Resolve target + source mode ───────────────────────────────────────────
TARGET="${1:-prod}"
case "$TARGET" in
  prod|staging)
    shift
    ;;
  *)
    # Legacy: ./deploy.sh <ref> means prod with that ref
    TARGET="prod"
    ;;
esac

REF="${1:-}"

case "$TARGET" in
  prod)
    APP_ROOT="${APP_ROOT:-/var/www/definity}"
    SERVICE="${SERVICE:-definity}"
    REPO_URL="${REPO_URL:-https://github.com/esterhuizen/definity-website.git}"
    SOURCE_MODE=git
    REF="${REF:-main}"
    ;;
  staging)
    APP_ROOT="${APP_ROOT:-/var/www/definity-staging}"
    SERVICE="${SERVICE:-definity-staging}"
    REPO_URL="${REPO_URL:-https://github.com/esterhuizen/definity-website.git}"
    if [ -z "$REF" ]; then
      SOURCE_MODE=worktree
      WORKTREE_DIR="${WORKTREE_DIR:-/home/ubuntu/build/definity-website}"
    else
      SOURCE_MODE=git
    fi
    ;;
esac

KEEP_RELEASES="${KEEP_RELEASES:-3}"

mkdir -p "$APP_ROOT/releases"

# ─── Stage source into a fresh release dir ──────────────────────────────────
STAMP="$(date -u +%Y-%m-%d-%H%M%S)"

if [ "$SOURCE_MODE" = "git" ]; then
  if [ ! -d "$APP_ROOT/repo.git" ]; then
    git clone --bare "$REPO_URL" "$APP_ROOT/repo.git"
  fi
  git --git-dir="$APP_ROOT/repo.git" fetch --prune origin '+refs/heads/*:refs/heads/*'
  SHA="$(git --git-dir="$APP_ROOT/repo.git" rev-parse "$REF" | cut -c1-7)"
  RELEASE="$APP_ROOT/releases/$STAMP-$SHA"
  echo "==> [$TARGET] Building release $STAMP-$SHA from ref $REF"
  mkdir -p "$RELEASE"
  git --git-dir="$APP_ROOT/repo.git" archive "$REF" | tar -x -C "$RELEASE"
else
  # Working-tree mode (staging only). Use git ls-files to enumerate exactly
  # the tracked + untracked-but-not-gitignored files — same set the next
  # `git status` would consider, minus everything in .gitignore.
  WT_HEAD="$(git -C "$WORKTREE_DIR" rev-parse --short HEAD 2>/dev/null || echo nohead)"
  WT_DIRTY=""
  if [ -n "$(git -C "$WORKTREE_DIR" status --porcelain)" ]; then
    WT_DIRTY="-dirty"
  fi
  RELEASE="$APP_ROOT/releases/$STAMP-${WT_HEAD}${WT_DIRTY}"
  echo "==> [$TARGET] Building release $STAMP-${WT_HEAD}${WT_DIRTY} from working tree at $WORKTREE_DIR"
  mkdir -p "$RELEASE"
  ( cd "$WORKTREE_DIR" \
      && git ls-files -co --exclude-standard \
      | tar -cf - -T - ) \
    | tar -x -C "$RELEASE"
fi

# ─── Build ──────────────────────────────────────────────────────────────────
cd "$RELEASE"
npm ci
# Populate public/stats.json + public/validators.json before build so the
# build-time prerender has live data (otherwise the homepage shows '—' for
# the first 30 min until ISR fires).
npm run stats:fetch || echo "WARN: stats:fetch failed; build will use placeholders"
npm run build

# next standalone needs ./public and ./.next/static colocated next to server.js.
# Symlink (not copy) so timer-written files (stats.json, validators.json,
# reports/*.html) are immediately visible to the standalone server without a redeploy.
rm -rf ".next/standalone/public" ".next/standalone/.next/static"
ln -s ../../public ".next/standalone/public"
ln -s ../../static ".next/standalone/.next/static"

# ─── Atomic symlink swap + restart ──────────────────────────────────────────
ln -sfn "$RELEASE" "$APP_ROOT/current.new"
mv -Tf "$APP_ROOT/current.new" "$APP_ROOT/current"

echo "==> [$TARGET] Reloading service: $SERVICE"
sudo systemctl restart "$SERVICE"

# Prune old releases
cd "$APP_ROOT/releases"
ls -1tr | head -n -"$KEEP_RELEASES" | xargs -r rm -rf

echo "==> [$TARGET] Deployed $RELEASE"
