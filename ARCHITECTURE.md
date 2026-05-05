# Architecture & Development Plan

## 1. System overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser (Next.js client)                        │
│  Auth pages · Dashboard · Create · Today · History · Blogs · SEO · …    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ fetch /api/*
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Next.js App Router (Vercel)                     │
│                                                                         │
│  /api/auth/*         NextAuth (credentials, JWT session)                │
│  /api/business-profile  Onboarding + website analysis                   │
│  /api/generate/post     LLM JSON-mode → Post row                        │
│  /api/generate/image    Provider → Sharp overlay → Cloudinary → Image  │
│  /api/posts             CRUD + status transitions                       │
│  /api/posts/[id]/publish  Meta Graph publish                            │
│  /api/blogs, /api/seo   Blog drafts + SEO bundles                       │
│  /api/social-accounts/* Meta OAuth start + callback                     │
│  /api/cron/daily-post   Hourly Vercel cron (CRON_SECRET-gated)          │
└──────────┬──────────────┬───────────────────┬────────────────────┬──────┘
           │              │                   │                    │
           ▼              ▼                   ▼                    ▼
     PostgreSQL      OpenAI API          Image Provider       Cloudinary
     (Prisma)       (gpt-4o-mini)     (Pollinations / OpenAI /  (CDN +
                                       Replicate)               transforms)
                                                                    │
                                                                    ▼
                                                            Meta Graph API
                                                            (Pages / IG Business)
```

## 2. Data model

Eight domain tables in `prisma/schema.prisma`:

| Table | Purpose |
|---|---|
| `users` | Account + auth credentials |
| `business_profiles` | One per user — site, audience, tone, logo, posting prefs |
| `social_accounts` | Per-Page + per-IG-account access tokens (server-only) |
| `posts` | Generated posts. Status: DRAFT → AWAITING_APPROVAL → SCHEDULED → PUBLISHED/FAILED |
| `images` | One image per post (raw + final URLs, provider) |
| `blogs` | SEO blog drafts (title, meta, slug, markdown, keywords) |
| `seo_suggestions` | Daily SEO bundle (titles, keywords, FAQs, outreach, directories) |
| `schedules` | Per-post job rows for the cron worker |

Plus NextAuth tables (`accounts`, `sessions`, `verification_tokens`).

Indexes: `(userId, status)` and `(userId, createdAt)` on posts; `(status, runAt)` on schedules; uniques on `(userId, slug)` for blogs and `(userId, forDate)` for SEO suggestions.

## 3. Generation pipeline

**Daily post:**
1. Pull `BusinessProfile` + last 14 topic strings to avoid repetition.
2. Call OpenAI in JSON mode with a strict schema (`hook`, `body`, `cta`, `hashtags`, `imagePrompt`, `fullCaption`).
3. Persist `Post` with `status=DRAFT` (or `AWAITING_APPROVAL` if cron-generated and `autoPublish=false`).
4. Optionally call image generation with the returned `imagePrompt`.

**Image:**
1. `lib/image-provider.ts` returns a URL from Pollinations / OpenAI / Replicate.
2. `lib/logo-overlay.ts` (Sharp) composites the user's logo at the configured corner.
3. `lib/cloudinary.ts` uploads both raw and final images.
4. Persist `Image` linked to the post.

**Blog & SEO:** same JSON-mode pattern with stricter schemas.

## 4. Approval & publishing

```
DRAFT ──user clicks "Generate"───┐
                                 ▼
                         AWAITING_APPROVAL ──"Approve & publish"──► PUBLISHED
                                 │                                    │
                                 ├─"Schedule"─► SCHEDULED ─cron──┘    │
                                 │                                    │
                                 └────────────"Auto publish on"───────┘

   Errors at any publish step: ──► FAILED (with failureReason)
```

`/api/posts/[id]/publish` reads the post + linked `SocialAccount` and calls
`lib/meta-publish.ts`. Each platform requires:
- **Facebook Page**: `POST /{page-id}/photos` (with image) or `/{page-id}/feed` (text-only). Page access token.
- **Instagram Business**: `POST /{ig-id}/media` to create a container, then `POST /{ig-id}/media_publish`. Image URL must be public.

## 5. Compliance posture

The original brief lists explicit safety rules. They are enforced as follows:

| Rule | Enforcement |
|---|---|
| No raw passwords | Only OAuth via Meta is supported. The `social_accounts` UI does not collect any credentials. |
| Only post to user-managed accounts | OAuth `me/accounts` returns *only* Pages the user manages. IG accounts are derived from those Pages. |
| Approval before publishing | `autoPublish=false` keeps posts in `AWAITING_APPROVAL`. Manual `Approve & publish` button on `PostCard`. |
| No spam comments / auto-follow | No code path calls `comments` or `follows` endpoints. |
| Backlink outreach is non-spammy | Generator prompt explicitly forbids spam tactics, link farms, PBNs, mass commenting. Outputs are drafts the user reviews + sends manually. |
| SEO directory submissions are manual | We list reputable directories — submission is performed by the user, not by us. |

## 6. Step-by-step development plan

### Phase 0 — Setup (10 min)
1. `npm install`
2. Provision Postgres (Neon free tier is fastest).
3. Copy `.env.example` → `.env`, fill `DATABASE_URL`, `NEXTAUTH_SECRET`, `OPENAI_API_KEY`, `CRON_SECRET`.
4. `npx prisma db push`.

### Phase 1 — MVP (already implemented)
- ✅ Email + password auth (NextAuth credentials).
- ✅ Business profile setup with optional website analysis.
- ✅ Post generation → DB → UI (Create Post, Today, History).
- ✅ Image generation with **free Pollinations.ai** default + Sharp logo overlay.
- ✅ Cloudinary upload (with data-URL fallback for local dev).
- ✅ Manual "Copy caption" + "Download image".
- ✅ Blog generator (SEO title, meta, headings, keywords, internal links, CTA).
- ✅ SEO suggestions (titles, keywords, FAQs, outreach drafts, directories).
- ✅ Dashboard with counts.

### Phase 2 — Meta auto-posting
- ✅ OAuth start + callback (already coded).
- ✅ Per-Page token storage.
- ✅ Manual "Approve & publish" → `meta-publish.ts`.
- ✅ Hourly cron (`vercel.json`) — picks users by `defaultPostTime`, generates + optionally publishes.
- ▢ **You'll do**: Create Meta App, request `pages_manage_posts` + `instagram_content_publish` review.

### Phase 3 — Scheduling UX & calendar
- ▢ Build a calendar UI (`/today` is the seed) — week + month views.
- ▢ Drag-drop to reschedule (writes `schedules.runAt`).
- ▢ Cron worker reads `schedules` where `status='PENDING' AND runAt <= now()` and publishes.

### Phase 4 — Analytics
- ▢ Pull post insights via `/{post-id}/insights` (FB) and `/{ig-media-id}/insights` (IG).
- ▢ Store snapshots, surface "best-performing content" on the dashboard.
- ▢ Add UTM-tagged website links → optional GA4 read-only integration for click tracking.

### Phase 5 — Polish
- ▢ Multi-language post generation (locale on `BusinessProfile`).
- ▢ Carousel & video posts (IG Reels, FB Reels).
- ▢ Team workspaces (Org table, role-based access).
- ▢ Webhook receiver for Meta deauthorization → tombstone tokens.

## 7. API surface (summary)

| Method | Path | Body / Query | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | `{name,email,password}` | Create account |
| GET/PUT | `/api/business-profile` | profile fields | Onboarding |
| POST | `/api/generate/post` | `{topic?}` | Generate a post |
| POST | `/api/generate/image` | `{prompt, postId?, logoPosition?}` | Generate image |
| GET/POST | `/api/posts` | `?status=…` | List / create |
| GET/PATCH/DELETE | `/api/posts/[id]` | partial post | Edit / delete |
| POST | `/api/posts/[id]/publish` | — | Publish via Meta |
| GET/POST | `/api/blogs` | `{topic?, targetKeyword?}` | Drafts |
| GET/PATCH/DELETE | `/api/blogs/[id]` | partial blog | Edit / delete |
| GET/POST | `/api/seo` | — | List / generate today's bundle |
| POST | `/api/upload` | multipart `file` | Logo upload |
| GET/DELETE | `/api/social-accounts` | `{id}` | List / disconnect |
| GET | `/api/social-accounts/meta/start` | — | OAuth start |
| GET | `/api/social-accounts/meta/callback` | `?code&state` | OAuth callback |
| GET | `/api/analytics` | — | Dashboard counts |
| GET | `/api/cron/daily-post` | header `Bearer CRON_SECRET` | Cron entry |

## 8. Things to watch in production

- **Token expiry**: Meta long-lived Page tokens last ~60 days. Add a daily refresh job.
- **Rate limits**: Meta enforces per-app and per-page rate limits. Implement exponential backoff (`meta-publish.ts` is the place).
- **Image hosting**: IG requires public, HTTPS image URLs ≥600×600. Cloudinary covers this; data-URL fallback won't work for IG publishing.
- **Content moderation**: Add a pre-publish check (regex + a moderation prompt) if you scale to many users.
- **Webhooks**: subscribe to Meta `User Deauthorize` and revoke tokens; subscribe to `permissions` changes to detect lost scopes.
