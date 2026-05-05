import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, bad } from '@/lib/api-utils';
import { exchangeRedditCode, fetchRedditMe } from '@/lib/publishers/reddit';

export async function GET(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.headers.get('cookie')?.match(/reddit_oauth_state=([^;]+)/)?.[1];
  if (!code || !state || state !== cookieState) return bad('Invalid OAuth state', 400);

  const tokens = await exchangeRedditCode(code);
  // Use the access token to fetch the username, then store the REFRESH token
  // (durable) as the SocialAccount.accessToken field.
  const me = await fetchRedditMe(tokens.accessToken);

  await prisma.socialAccount.upsert({
    where: {
      userId_platform_externalId: { userId, platform: 'reddit', externalId: me.id },
    },
    create: {
      userId,
      platform: 'reddit',
      externalId: me.id,
      name: `u/${me.name}`,
      pictureUrl: me.iconImg ?? null,
      accessToken: tokens.refreshToken, // store the long-lived refresh token
      tokenExpiresAt: null,
      scopes: ['identity', 'submit', 'read'],
    },
    update: {
      name: `u/${me.name}`,
      pictureUrl: me.iconImg ?? null,
      accessToken: tokens.refreshToken,
    },
  });

  return NextResponse.redirect(new URL('/social-accounts?connected=reddit', req.url));
}
