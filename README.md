# Post Agent

AI-powered social media + SEO growth agent. Generates daily on-brand posts (FB & IG-ready), creates matching images with your logo overlaid, drafts SEO-optimized blogs, suggests SEO/backlink tactics — and (Phase 2) auto-publishes through the official Meta Graph API.

> **Compliance first.** No raw passwords. Only official Meta OAuth. No spam comments, no auto-follow, no posting to accounts you don't manage. An approval step is supported before publishing.

## Quickstart

```bash
# 1. Install deps
npm install

# 2. Configure environment
cp .env.example .env
#   - DATABASE_URL    (Postgres — Neon / Supabase / Railway / local)
#   - NEXTAUTH_SECRET (run: openssl rand -base64 32)
#   - OPENAI_API_KEY  (text generation)
#   - IMAGE_PROVIDER  (defaults to "pollinations" — FREE, no key)
#   - CLOUDINARY_*    (optional in dev — falls back to data URLs)
#   - CRON_SECRET     (any long random string)

# 3. Push the schema
npx prisma db push

# 4. Run
npm run dev
# → http://localhost:3000
```

Register an account at `/register`, fill in your business profile in **Settings**, then go to **Create Post**.

## What's in the box

```
post-agent/
├─ prisma/schema.prisma          ← 8 domain tables + NextAuth tables
├─ app/
│  ├─ (auth)/login, register     ← email + password (NextAuth credentials)
│  ├─ (dashboard)/
│  │   ├─ dashboard              ← stats + recent posts
│  │   ├─ create-post            ← generate post + image, position logo
│  │   ├─ today                  ← today's posts, approve & publish
│  │   ├─ posts                  ← full history with status filter
│  │   ├─ blogs                  ← SEO blog generator + library
│  │   ├─ seo                    ← daily SEO bundle (titles, FAQs, outreach)
│  │   ├─ settings               ← business profile, logo, posting prefs
│  │   └─ social-accounts        ← Meta OAuth connect / disconnect
│  └─ api/
│      ├─ auth/                  ← NextAuth + register
│      ├─ business-profile       ← GET/PUT (with optional website analysis)
│      ├─ posts, posts/[id], posts/[id]/publish
│      ├─ generate/post          ← LLM → JSON post
│      ├─ generate/image         ← image → logo overlay → Cloudinary
│      ├─ blogs, blogs/[id]
│      ├─ seo                    ← daily SEO bundle
│      ├─ upload                 ← logo file upload
│      ├─ social-accounts        ← list / disconnect (no token leaks)
│      ├─ social-accounts/meta/start, /callback   ← OAuth flow
│      ├─ analytics              ← dashboard counts
│      └─ cron/daily-post        ← Vercel cron entry (CRON_SECRET-gated)
├─ lib/
│  ├─ prisma.ts, auth.ts, openai.ts, api-utils.ts
│  ├─ image-provider.ts          ← pluggable: pollinations | openai | replicate
│  ├─ logo-overlay.ts            ← Sharp compositing
│  ├─ cloudinary.ts              ← upload helpers
│  ├─ website-analyzer.ts        ← cheerio + LLM site brief
│  ├─ content-generator.ts       ← post / blog / SEO JSON-mode prompts
│  └─ meta-publish.ts            ← FB Page & IG Business publishing
├─ components/
│  ├─ Sidebar.tsx, Providers.tsx, PostCard.tsx
└─ vercel.json                   ← hourly cron
```

## Environment

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | yes | NextAuth |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | yes | Text generation (default `gpt-4o-mini`) |
| `IMAGE_PROVIDER` | no | `pollinations` (default, free), `openai`, or `replicate` |
| `REPLICATE_API_TOKEN` | only if Replicate | FLUX-schnell via Replicate |
| `CLOUDINARY_*` | recommended | Image storage + CDN; falls back to data URLs in dev |
| `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` | Phase 2 | Auto-posting |
| `CRON_SECRET` | yes for cron | Authorizes `/api/cron/daily-post` |

## Image generation — pluggable

Default is **Pollinations.ai** (FLUX) — completely free, no API key. Swap providers with one env var:

```env
IMAGE_PROVIDER="pollinations"   # default — FREE
# IMAGE_PROVIDER="openai"       # gpt-image-1 / DALL·E 3 (uses OPENAI_API_KEY)
# IMAGE_PROVIDER="replicate"    # FLUX-schnell (uses REPLICATE_API_TOKEN)
```

The pipeline is identical regardless of provider:

```
prompt ─► provider ─► fetch buffer ─► Sharp logo overlay ─► Cloudinary ─► DB
```

## Auto-posting (Phase 2 — Meta Graph API)

1. Create a Meta App → add **Facebook Login for Business** + **Instagram Graph API**.
2. Add OAuth redirect: `${NEXTAUTH_URL}/api/social-accounts/meta/callback`.
3. Set `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` in `.env`.
4. In the app, open **Social Accounts** → **Connect Facebook & Instagram**.
5. We request only what's needed: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`.
6. The callback stores per-Page tokens and the connected IG Business account id.

Publishing rules built into the code:
- We only publish to Pages and IG accounts the user explicitly connected.
- `Auto publish` is off by default — posts land in **Awaiting approval** until the user clicks **Approve & publish**.
- No auto-comment, no auto-follow, no engaging with arbitrary pages.

## Daily cron

`vercel.json` runs `/api/cron/daily-post` hourly. The route picks any user whose `defaultPostTime`'s hour matches, generates a post + image, and either publishes (if `autoPublish` is on and an account is connected) or leaves the post in `AWAITING_APPROVAL`.

The route requires `Authorization: Bearer ${CRON_SECRET}`.

## Local DB without a server

If you don't have Postgres handy, [Neon](https://neon.tech) gives you a free serverless Postgres URL in 30 seconds. Drop it into `DATABASE_URL` and `npx prisma db push`.

## Roadmap

See `ARCHITECTURE.md` for the architecture deep-dive and the step-by-step development plan.
