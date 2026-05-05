import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { dispatchPublish } from '@/lib/publish-dispatcher';

const schema = z.object({
  /// Account ids to publish to. If omitted, publish to ALL connected accounts.
  socialAccountIds: z.array(z.string()).optional(),
  /// Optional per-account subreddit override (Reddit). If omitted, uses the
  /// user's enabled SyndicationTargets for Reddit.
  redditSubreddits: z.array(z.string()).optional(),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const body = await req.json().catch(() => ({}));
    const { socialAccountIds, redditSubreddits } = schema.parse(body);

    const post = await prisma.post.findFirst({
      where: { id: ctx.params.id, userId },
      include: { image: true },
    });
    if (!post) return bad('Not found', 404);

    const profile = await prisma.businessProfile.findUnique({ where: { userId } });

    const accounts = await prisma.socialAccount.findMany({
      where: {
        userId,
        ...(socialAccountIds && socialAccountIds.length > 0 ? { id: { in: socialAccountIds } } : {}),
      },
    });
    if (accounts.length === 0) return bad('No connected accounts to publish to', 400);

    const subs =
      redditSubreddits && redditSubreddits.length > 0
        ? redditSubreddits
        : (
            await prisma.syndicationTarget.findMany({
              where: { userId, platform: 'reddit', enabled: true },
            })
          ).map((t) => t.targetRef);

    const results: any[] = [];

    for (const account of accounts) {
      const targets =
        account.platform === 'reddit' ? (subs.length > 0 ? subs : []) : [undefined as undefined];

      if (account.platform === 'reddit' && targets.length === 0) {
        results.push({
          platform: 'reddit',
          account: account.name,
          ok: false,
          error: 'No subreddits added. Add at least one in Syndication Targets.',
        });
        continue;
      }

      for (const target of targets) {
        const pub = await prisma.postPublication.create({
          data: {
            postId: post.id,
            socialAccountId: account.id,
            status: 'SCHEDULED',
          },
        });
        try {
          const r = await dispatchPublish({
            post,
            account,
            profile,
            subreddit: target,
          });
          await prisma.postPublication.update({
            where: { id: pub.id },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              externalPostId: r.externalPostId,
              externalUrl: r.externalUrl ?? null,
            },
          });
          // For reddit, bump the cooldown timer on the target row
          if (account.platform === 'reddit' && target) {
            await prisma.syndicationTarget.updateMany({
              where: { userId, platform: 'reddit', targetRef: target },
              data: { lastPostedAt: new Date() },
            });
          }
          results.push({
            platform: account.platform,
            account: account.name,
            target: target ?? null,
            ok: true,
            externalUrl: r.externalUrl,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Publish failed';
          await prisma.postPublication.update({
            where: { id: pub.id },
            data: { status: 'FAILED', failureReason: msg },
          });
          results.push({
            platform: account.platform,
            account: account.name,
            target: target ?? null,
            ok: false,
            error: msg,
          });
        }
      }
    }

    // Roll up post status
    const anyOk = results.some((r) => r.ok);
    await prisma.post.update({
      where: { id: post.id },
      data: { status: anyOk ? 'PUBLISHED' : 'FAILED', publishedAt: anyOk ? new Date() : undefined },
    });

    return ok({ results });
  } catch (e) {
    return fail(e);
  }
}
