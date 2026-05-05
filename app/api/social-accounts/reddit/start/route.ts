import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireUser, bad } from '@/lib/api-utils';
import { buildRedditAuthUrl } from '@/lib/publishers/reddit';

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_REDIRECT_URI) {
    return bad('Reddit OAuth is not configured (set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REDIRECT_URI in .env)', 501);
  }
  const state = `${userId}.${crypto.randomBytes(16).toString('hex')}`;
  const url = buildRedditAuthUrl(state);
  const res = NextResponse.redirect(url);
  res.cookies.set('reddit_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
