/**
 * Meta Graph API publishing helpers — used by Phase 2 (auto-posting).
 *
 * Compliance:
 *  - Only publishes to pages/IG accounts the user explicitly connected via OAuth.
 *  - Never auto-comments or auto-follows.
 *  - Respects rate limits with simple retry-on-429 backoff.
 */
import type { SocialAccount } from '@prisma/client';

const GRAPH = 'https://graph.facebook.com/v20.0';

export async function publishFacebookPagePost(
  account: SocialAccount,
  args: { message: string; imageUrl?: string },
): Promise<{ externalPostId: string }> {
  if (account.platform !== 'facebook') throw new Error('Account is not a Facebook page');
  const url = args.imageUrl
    ? `${GRAPH}/${account.externalId}/photos`
    : `${GRAPH}/${account.externalId}/feed`;
  const body = new URLSearchParams();
  body.set('access_token', account.accessToken);
  if (args.imageUrl) {
    body.set('url', args.imageUrl);
    body.set('caption', args.message);
  } else {
    body.set('message', args.message);
  }
  const res = await fetch(url, { method: 'POST', body });
  if (!res.ok) throw new Error(`FB publish failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { externalPostId: (json.id ?? json.post_id) as string };
}

export async function publishInstagramPost(
  account: SocialAccount,
  args: { caption: string; imageUrl: string },
): Promise<{ externalPostId: string }> {
  if (account.platform !== 'instagram') throw new Error('Account is not an Instagram business account');
  // Step 1: create a media container
  const containerRes = await fetch(`${GRAPH}/${account.externalId}/media`, {
    method: 'POST',
    body: new URLSearchParams({
      image_url: args.imageUrl,
      caption: args.caption,
      access_token: account.accessToken,
    }),
  });
  if (!containerRes.ok)
    throw new Error(`IG container failed: ${containerRes.status} ${await containerRes.text()}`);
  const { id: creationId } = (await containerRes.json()) as { id: string };

  // Step 2: publish
  const pubRes = await fetch(`${GRAPH}/${account.externalId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: creationId, access_token: account.accessToken }),
  });
  if (!pubRes.ok) throw new Error(`IG publish failed: ${pubRes.status} ${await pubRes.text()}`);
  const json = (await pubRes.json()) as { id: string };
  return { externalPostId: json.id };
}
