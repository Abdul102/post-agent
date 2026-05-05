import { NextResponse } from 'next/server';
import { requireUser, bad } from '@/lib/api-utils';
import crypto from 'node:crypto';

/**
 * Phase 2 — Meta OAuth start.
 * Redirects the user to Facebook's OAuth dialog with the scopes required to
 * publish to a Facebook Page and to a connected Instagram Business account.
 *
 * Required scopes (per Meta docs):
 *  - pages_show_list, pages_read_engagement, pages_manage_posts
 *  - instagram_basic, instagram_content_publish
 *  - business_management
 *
 * NEVER request more than the user's own pages/IG accounts.
 */
export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;
  const appId = process.env.META_APP_ID;
  const redirect = process.env.META_REDIRECT_URI;
  if (!appId || !redirect) return bad('Meta OAuth is not configured', 501);

  const state = `${userId}.${crypto.randomBytes(16).toString('hex')}`;
  const url = new URL('https://www.facebook.com/v20.0/dialog/oauth');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('state', state);
  url.searchParams.set(
    'scope',
    [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
    ].join(','),
  );
  url.searchParams.set('response_type', 'code');

  const res = NextResponse.redirect(url.toString());
  // Tie the state to the user via a short-lived cookie to defend against CSRF.
  res.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
