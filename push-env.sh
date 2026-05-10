#!/bin/bash
cd "/Users/abdulrehman/Documents/Claude/Projects/facebook agent/nextgen-growth-agent"
set -a; source .env; set +a
NEXTAUTH_URL="https://post-agent-sigma.vercel.app"
META_REDIRECT_URI="https://post-agent-sigma.vercel.app/api/social-accounts/meta/callback"
VARS=(DATABASE_URL NEXTAUTH_URL NEXTAUTH_SECRET OPENAI_API_KEY OPENAI_BASE_URL OPENAI_MODEL IMAGE_PROVIDER META_APP_ID META_APP_SECRET META_REDIRECT_URI CRON_SECRET CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET REDDIT_CLIENT_ID REDDIT_CLIENT_SECRET REDDIT_REDIRECT_URI)
for KEY in "${VARS[@]}"; do
  VAL="${!KEY}"
  if [ -z "$VAL" ]; then echo "Skip $KEY (empty)"; continue; fi
  echo "→ Pushing $KEY..."
  npx vercel env rm "$KEY" production -y 2>/dev/null
  printf "%s" "$VAL" | npx vercel env add "$KEY" production
done
echo "Done."
