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

# ─── Prod pipeline guard ────────────────────────────────────────────────────
# Prod is a PROMOTION of a sha already proven on staging, built from pushed
# main on GitHub. Anything else is refused. Emergency escape hatch: FORCE_PROD=1
# (use it only for a rollback/hotfix and say so out loud).
if [ "$TARGET" = "prod" ] && [ "${FORCE_PROD:-0}" != "1" ]; then
  GUARD_WT="${GUARD_WORKTREE:-/home/ubuntu/build/definity-redesign}"
  # 1. No uncommitted tracked changes (deliberately-untracked staging-only files are fine).
  if [ -n "$(git -C "$GUARD_WT" status --porcelain --untracked-files=no 2>/dev/null)" ]; then
    echo "PROD GUARD: tracked changes in $GUARD_WT are not committed." >&2
    echo "            The cycle is: iterate on staging -> ONE clean commit -> push -> promote." >&2
    exit 1
  fi
  # 2. main must actually be on GitHub.
  git -C "$GUARD_WT" fetch -q origin main 2>/dev/null || true
  LOCAL_MAIN="$(git -C "$GUARD_WT" rev-parse --short=7 main 2>/dev/null)"
  REMOTE_MAIN="$(git -C "$GUARD_WT" rev-parse --short=7 origin/main 2>/dev/null)"
  if [ -z "$REMOTE_MAIN" ] || [ "$LOCAL_MAIN" != "$REMOTE_MAIN" ]; then
    echo "PROD GUARD: local main ($LOCAL_MAIN) != origin/main ($REMOTE_MAIN) — push first; GitHub drives prod." >&2
    exit 1
  fi
  # 3. Promote only what staging is running right now.
  STAGING_SHA="$(basename "$(readlink /var/www/definity-staging/current 2>/dev/null)" | sed 's/-dirty$//' | grep -oE '[0-9a-f]{7}$')"
  if [ -n "$STAGING_SHA" ] && [ "$STAGING_SHA" != "$REMOTE_MAIN" ]; then
    echo "PROD GUARD: staging runs $STAGING_SHA but main is $REMOTE_MAIN — deploy + verify staging first." >&2
    exit 1
  fi
  echo "==> [prod] guard ok: promoting $REMOTE_MAIN (clean tree, pushed, staging-verified)"
fi

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
  # Subtract deleted-on-disk-but-still-tracked files (e.g. mid-edit) so
  # tar doesn't fail with "Cannot stat: No such file or directory".
  ( cd "$WORKTREE_DIR" \
      && comm -23 \
          <(git ls-files -co --exclude-standard | sort -u) \
          <(git ls-files -d                     | sort -u) \
      | tar -cf - -T - ) \
    | tar -x -C "$RELEASE"
fi

# ─── Build ──────────────────────────────────────────────────────────────────
cd "$RELEASE"
npm ci
# Populate public/stats.json + public/validators.json before build so the
# build-time prerender has live data (otherwise the homepage shows '—' for
# the first 30 min until ISR fires).
#
# Seed last-good data forward from the live release FIRST: these files are
# gitignored, so the git-archive release ships without them → stats:fetch starts
# from prev={} and, when the build box's public RPC 429s on the heavy holdings
# call, bakes a null sleeve %. Carrying the current file forward gives the
# collector's lastGood() a recent prev to hold, so a build-time blip keeps the
# real value instead of an em-dash. MUST run before stats:fetch. Cold box with no
# current/ → the copies no-op and stats:fetch fills what it can.
mkdir -p public
for f in stats.json validators.json; do cp "$APP_ROOT/current/public/$f" "public/$f" 2>/dev/null || true; done
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
