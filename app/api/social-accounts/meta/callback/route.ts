import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, bad } from '@/lib/api-utils';

/**
 * Phase 2 — Meta OAuth callback.
 * Exchanges the auth code for a long-lived user token, then for each Page
 * stores the page access token and the connected IG Business account (if any).
 */
export async function GET(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.headers.get('cookie')?.match(/meta_oauth_state=([^;]+)/)?.[1];
  if (!code || !state || !cookieState || state !== cookieState) return bad('Invalid OAuth state', 400);

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirect = process.env.META_REDIRECT_URI;
  if (!appId || !appSecret || !redirect) return bad('Meta OAuth is not configured', 501);

  // 1) Short-lived user token
  const tokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', appId);
  tokenUrl.searchParams.set('client_secret', appSecret);
  tokenUrl.searchParams.set('redirect_uri', redirect);
  tokenUrl.searchParams.set('code', code);
  const tRes = await fetch(tokenUrl.toString());
  if (!tRes.ok) return bad('Token exchange failed', 502);
  const tJson = await tRes.json();
  const shortToken = tJson.access_token as string;

  // 2) Long-lived user token
  const llUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
  llUrl.searchParams.set('grant_type', 'fb_exchange_token');
  llUrl.searchParams.set('client_id', appId);
  llUrl.searchParams.set('client_secret', appSecret);
  llUrl.searchParams.set('fb_exchange_token', shortToken);
  const llRes = await fetch(llUrl.toString());
  const llJson = await llRes.json();
  const longUserToken = (llJson.access_token as string) ?? shortToken;
  const expiresIn = llJson.expires_in as number | undefined;

  // 3) List the user's Pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,picture{url},instagram_business_account&access_token=${encodeURIComponent(longUserToken)}`,
  );
  const pagesJson = await pagesRes.json();
  const pages: any[] = pagesJson.data ?? [];

  for (const page of pages) {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    await prisma.socialAccount.upsert({
      where: {
        userId_platform_externalId: { userId, platform: 'facebook', externalId: page.id },
      },
      create: {
        userId,
        platform: 'facebook',
        externalId: page.id,
        name: page.name,
        pictureUrl: page.picture?.data?.url ?? null,
        accessToken: page.access_token,
        tokenExpiresAt: expiresAt,
        scopes: ['pages_manage_posts'],
      },
      update: {
        name: page.name,
        pictureUrl: page.picture?.data?.url ?? null,
        accessToken: page.access_token,
        tokenExpiresAt: expiresAt,
      },
    });

    if (page.instagram_business_account?.id) {
      const igId = page.instagram_business_account.id;
      const igRes = await fetch(
        `https://graph.facebook.com/v20.0/${igId}?fields=id,username,profile_picture_url&access_token=${encodeURIComponent(page.access_token)}`,
      );
      const ig = await igRes.json();
      await prisma.socialAccount.upsert({
        where: { userId_platform_externalId: { userId, platform: 'instagram', externalId: igId } },
        create: {
          userId,
          platform: 'instagram',
          externalId: igId,
          name: ig.username ?? page.name,
          pictureUrl: ig.profile_picture_url ?? null,
          accessToken: page.access_token, // IG publishing uses the page token
          tokenExpiresAt: expiresAt,
          scopes: ['instagram_content_publish'],
        },
        update: {
          name: ig.username ?? page.name,
          pictureUrl: ig.profile_picture_url ?? null,
          accessToken: page.access_token,
          tokenExpiresAt: expiresAt,
        },
      });
    }
  }

  return NextResponse.redirect(new URL('/social-accounts?connected=1', req.url));
}
