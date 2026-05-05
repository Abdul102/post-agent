/**
 * Reddit publisher.
 *
 * Auth: Reddit "installed app" OAuth (script-style). Each user grants the
 * `submit identity` scopes; we store their refresh token and exchange for a
 * fresh access token on every publish.
 *
 * Compliance:
 *  - Posts ONLY to subreddits the user explicitly added as a SyndicationTarget.
 *  - Respects per-subreddit cooldown (defaults to 1 week per subreddit).
 *  - User must be a member and follow each sub's self-promotion rules.
 */

import type { SocialAccount } from '@prisma/client';

const REDDIT = 'https://oauth.reddit.com';
const USER_AGENT = 'PostAgent/1.0 by u/post-agent';

export function buildRedditAuthUrl(state: string): string {
  const id = process.env.REDDIT_CLIENT_ID;
  const redirect = process.env.REDDIT_REDIRECT_URI;
  if (!id || !redirect) throw new Error('Reddit OAuth not configured');
  const u = new URL('https://www.reddit.com/api/v1/authorize');
  u.searchParams.set('client_id', id);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('state', state);
  u.searchParams.set('redirect_uri', redirect);
  u.searchParams.set('duration', 'permanent');
  u.searchParams.set('scope', 'identity submit read');
  return u.toString();
}

export async function exchangeRedditCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const id = process.env.REDDIT_CLIENT_ID!;
  const secret = process.env.REDDIT_CLIENT_SECRET!;
  const redirect = process.env.REDDIT_REDIRECT_URI!;
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const r = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirect,
    }),
  });
  if (!r.ok) throw new Error(`Reddit token exchange failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: new Date(Date.now() + (j.expires_in ?? 3600) * 1000),
  };
}

async function refreshRedditAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const id = process.env.REDDIT_CLIENT_ID!;
  const secret = process.env.REDDIT_CLIENT_SECRET!;
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const r = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!r.ok) throw new Error(`Reddit refresh failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return {
    accessToken: j.access_token,
    expiresAt: new Date(Date.now() + (j.expires_in ?? 3600) * 1000),
  };
}

export async function fetchRedditMe(accessToken: string): Promise<{
  name: string;
  id: string;
  iconImg?: string;
}> {
  const r = await fetch(`${REDDIT}/api/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': USER_AGENT },
  });
  if (!r.ok) throw new Error(`Reddit me failed: ${r.status}`);
  const j = await r.json();
  return { name: j.name, id: j.id, iconImg: j.icon_img?.split('?')[0] };
}

export interface RedditSubmitInput {
  subreddit: string; // without 'r/'
  title: string;
  /// For link posts:
  url?: string;
  /// For self (text) posts:
  text?: string;
  /// 'self' or 'link'
  kind?: 'self' | 'link';
  /// Additional flair if subreddit requires it
  flairId?: string;
  flairText?: string;
}

export async function submitToReddit(
  account: SocialAccount,
  input: RedditSubmitInput,
): Promise<{ externalPostId: string; externalUrl: string }> {
  // The SocialAccount stores `accessToken` as the REFRESH token for Reddit
  // (refresh tokens are durable; access tokens expire hourly).
  const refreshed = await refreshRedditAccessToken(account.accessToken);
  const params = new URLSearchParams();
  params.set('sr', input.subreddit.replace(/^r\//, ''));
  params.set('title', input.title.slice(0, 300));
  params.set('api_type', 'json');
  if (input.kind === 'link' || input.url) {
    params.set('kind', 'link');
    params.set('url', input.url ?? '');
  } else {
    params.set('kind', 'self');
    params.set('text', input.text ?? '');
  }
  if (input.flairId) params.set('flair_id', input.flairId);
  if (input.flairText) params.set('flair_text', input.flairText);

  const r = await fetch(`${REDDIT}/api/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${refreshed.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: params,
  });
  if (!r.ok) throw new Error(`Reddit submit failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const errs: any[] = j?.json?.errors ?? [];
  if (errs.length > 0) {
    throw new Error(`Reddit rejected post: ${errs.map((e) => e.join(' ')).join('; ')}`);
  }
  const url = j?.json?.data?.url as string | undefined;
  const id = j?.json?.data?.id as string | undefined;
  if (!url || !id) throw new Error('Reddit response missing url/id');
  return { externalPostId: id, externalUrl: url };
}
