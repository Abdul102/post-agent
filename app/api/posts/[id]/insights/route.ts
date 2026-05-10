import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';

const GRAPH = 'https://graph.facebook.com/v20.0';

/**
 * Refresh cached impression / reach / engagement counts for a published post
 * via Meta Graph API insights. Falls back gracefully if the post is on a
 * platform we don't support yet.
 */
export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const post = await prisma.post.findFirst({
      where: { id: ctx.params.id, userId },
      include: { socialAccount: true },
    });
    if (!post) return bad('Not found', 404);
    if (post.status !== 'PUBLISHED' || !post.externalPostId) {
      return bad('Post is not published yet', 412);
    }
    const account = post.socialAccount;
    if (!account) return bad('No social account linked', 412);

    let impressions = 0;
    let reach = 0;
    let engagements = 0;

    if (account.platform === 'facebook') {
      // FB Page post insights
      const url = `${GRAPH}/${post.externalPostId}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users&access_token=${encodeURIComponent(account.accessToken)}`;
      const r = await fetch(url);
      if (!r.ok) return bad(`FB insights failed: ${r.status}`);
      const j = await r.json();
      for (const m of j.data ?? []) {
        const v = Number(m.values?.[0]?.value ?? 0);
        if (m.name === 'post_impressions') impressions = v;
        else if (m.name === 'post_impressions_unique') reach = v;
        else if (m.name === 'post_engaged_users') engagements = v;
      }
    } else if (account.platform === 'instagram') {
      // IG insights — different metric set
      const url = `${GRAPH}/${post.externalPostId}/insights?metric=impressions,reach,engagement&access_token=${encodeURIComponent(account.accessToken)}`;
      const r = await fetch(url);
      if (!r.ok) return bad(`IG insights failed: ${r.status}`);
      const j = await r.json();
      for (const m of j.data ?? []) {
        const v = Number(m.values?.[0]?.value ?? 0);
        if (m.name === 'impressions') impressions = v;
        else if (m.name === 'reach') reach = v;
        else if (m.name === 'engagement') engagements = v;
      }
    } else {
      return bad(`Insights not supported for platform: ${account.platform}`, 412);
    }

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { impressions, reach, engagements, insightsAt: new Date() },
    });
    return ok({ post: updated });
  } catch (e) {
    return fail(e);
  }
}
