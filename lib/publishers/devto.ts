/**
 * Dev.to publisher.
 *
 * Auth: Personal API key (https://dev.to/settings/extensions). No OAuth.
 * The user pastes their key once; we store it as SocialAccount.accessToken.
 */

import type { SocialAccount } from '@prisma/client';

const API = 'https://dev.to/api';

export async function fetchDevtoUser(apiKey: string): Promise<{
  id: number;
  username: string;
  name: string;
  profileImage?: string;
}> {
  const r = await fetch(`${API}/users/me`, { headers: { 'api-key': apiKey } });
  if (!r.ok) throw new Error(`Dev.to auth failed: ${r.status}`);
  const j = await r.json();
  return {
    id: j.id,
    username: j.username,
    name: j.name ?? j.username,
    profileImage: j.profile_image,
  };
}

export interface DevtoArticleInput {
  title: string;
  bodyMarkdown: string;
  /// Optional comma-separated tags (max 4 on Dev.to)
  tags?: string[];
  /// Canonical URL — set this to the user's website link to avoid duplicate-content SEO penalties.
  canonicalUrl?: string;
  /// If false, draft. If true, published immediately.
  published?: boolean;
  /// Optional cover image URL
  mainImage?: string;
}

export async function publishToDevto(
  account: SocialAccount,
  input: DevtoArticleInput,
): Promise<{ externalPostId: string; externalUrl: string }> {
  const r = await fetch(`${API}/articles`, {
    method: 'POST',
    headers: {
      'api-key': account.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      article: {
        title: input.title.slice(0, 128),
        body_markdown: input.bodyMarkdown,
        published: input.published ?? true,
        tags: (input.tags ?? []).slice(0, 4).map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')),
        canonical_url: input.canonicalUrl,
        main_image: input.mainImage,
      },
    }),
  });
  if (!r.ok) throw new Error(`Dev.to publish failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return { externalPostId: String(j.id), externalUrl: j.url };
}
