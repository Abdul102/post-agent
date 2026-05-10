#!/bin/bash
# One-shot deploy script for Post Agent.
# Run from inside the project directory:
#   chmod +x deploy.sh && ./deploy.sh
#
# What it does:
#   1) Clears stale git lock (if any)
#   2) Pushes new schema to your production Postgres (Neon) via prisma db push
#   3) Pushes env vars (incl. Cloudinary) to Vercel production
#   4) Verifies the build locally
#   5) Commits all new files and pushes to GitHub  → Vercel auto-deploys
#   6) Prints follow-up instructions for the external cron (auto-schedule)

set -e

cd "$(dirname "$0")"
ROOT="$(pwd)"
echo "▶  Project: $ROOT"
echo

# ── 1) Stale git lock ──────────────────────────────────────────────────────
if [ -f .git/index.lock ]; then
  echo "▶  Removing stale .git/index.lock"
  rm -f .git/index.lock
fi

# ── 2) Prisma schema push ──────────────────────────────────────────────────
echo "▶  Pushing schema to production database (Neon)…"
echo "   Loading DATABASE_URL from .env"
set -a; source .env; set +a
if [ -z "$DATABASE_URL" ]; then
  echo "✖  DATABASE_URL is empty in .env — aborting"
  exit 1
fi
npx prisma db push --skip-generate
echo "✓  Schema migrated"
echo

# ── 3) Push env vars to Vercel ─────────────────────────────────────────────
echo "▶  Pushing env vars to Vercel production…"
if ! command -v vercel >/dev/null 2>&1 && ! npx vercel --version >/dev/null 2>&1; then
  echo "   Installing Vercel CLI on the fly via npx…"
fi
chmod +x push-env.sh
./push-env.sh
echo "✓  Env vars pushed"
echo

# ── 4) Build verify ────────────────────────────────────────────────────────
echo "▶  Local build (to catch errors before pushing)…"
npm run build
echo "✓  Build OK"
echo

# ── 5) Commit + push ───────────────────────────────────────────────────────
echo "▶  Committing changes…"
git add -A
git diff --cached --quiet && {
  echo "   Nothing to commit — already up to date."
} || {
  git commit -m "feat: title/upload/crop, edit modal, multi-platform preview, blog→FB, AI SEO writer, competitors, auto-schedule, blog views, FB insights"
}
echo "▶  Pushing to GitHub (Vercel will auto-deploy)…"
git push origin main
echo "✓  Pushed"
echo

# ── 6) Follow-up ───────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════════"
echo " ✓  DEPLOY DONE"
echo "════════════════════════════════════════════════════════════════════"
echo
echo " Open the Vercel dashboard to watch the deploy:"
echo "   https://vercel.com/dashboard"
echo
echo " ── ONE MANUAL STEP REMAINING ──────────────────────────────────────"
echo "   Auto-Schedule (multi-post-per-day) needs an external cron."
echo "   Vercel Hobby allows only 1 daily cron, so we use cron-job.org:"
echo
echo "   1. Go to https://cron-job.org → Sign up free"
echo "   2. Create job:"
echo "        URL:      https://post-agent-sigma.vercel.app/api/cron/run-schedules"
echo "        Schedule: every 10 minutes"
echo "        Headers:  Authorization: Bearer \$CRON_SECRET"
echo "                  (use the same value as in your .env)"
echo "   3. Save and enable."
echo
echo " Once that cron is live, your /schedules page will start"
echo " auto-generating + auto-publishing posts in your time range."
echo "════════════════════════════════════════════════════════════════════"
