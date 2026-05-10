import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { z } from 'zod';

const schema = z.object({
  publish: z.boolean().optional().default(false),
  publishAll: z.boolean().optional().default(false),
});

/**
 * Convert a blog draft into a social Post (and optionally publish it).
 *
 * The blog body is condensed into a Hook + Body + CTA (FB-friendly), with a
 * link back to the public blog page. Image is reused if the blog already has
 * one (future); otherwise the user can attach one from /create-post or the
 * post-history Edit modal.
 */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const blog = await prisma.blog.findFirst({ where: { id: ctx.params.id, userId } });
    if (!blog) return bad('Blog not found', 404);
    const body = await req.json().catch(() => ({}));
    const { publish, publishAll } = schema.parse(body);

    const profile = await prisma.businessProfile.findUnique({ where: { userId } });
    const websiteUrl = profile?.websiteUrl;
    const blogUrl = websiteUrl ? `${websiteUrl.replace(/\/$/, '')}/blog/${blog.slug}` : null;

    // Build a tight FB caption from the blog
    const hook = blog.seoTitle;
    const intro = blog.metaDescription?.trim() || stripMarkdown(blog.contentMarkdown).slice(0, 240);
    const cta = blogUrl ? `Read the full guide → ${blogUrl}` : 'Read the full guide on our blog';
    const hashtags = (blog.keywords ?? []).slice(0, 6).map((k) =>
      k.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30),
    ).filter(Boolean);
    const tagLine = hashtags.length ? '\n\n' + hashtags.map((t) => `#${t}`).join(' ') : '';
    const fullCaption = `${hook}\n\n${intro}\n\n${cta}${tagLine}`;

    const post = await prisma.post.create({
      data: {
        userId,
        title: blog.seoTitle.slice(0, 200),
        topic: `Blog: ${blog.seoTitle}`,
        hook,
        body: intro,
        cta,
        hashtags,
        websiteLink: blogUrl ?? websiteUrl ?? null,
        fullCaption,
        status: 'DRAFT',
      },
    });

    if (!publish && !publishAll) {
      return ok({ post });
    }

    // Publish
    const accounts = await prisma.socialAccount.findMany({ where: { userId } });
    if (accounts.length === 0) return ok({ post, warning: 'No connected accounts to publish to' });

    if (publishAll) {
      // delegate to the existing publish-multi route by importing the logic
      const { dispatchPublish } = await import('@/lib/publish-dispatcher');
      const reloaded = await prisma.post.findUnique({
        where: { id: post.id },
        include: { image: true },
      });
      if (!reloaded) return ok({ post });
      const results = [];
      for (const account of accounts) {
        try {
          const r = await dispatchPublish({ post: reloaded, account, profile: profile ?? null });
          await prisma.postPublication.create({
            data: {
              postId: post.id,
              socialAccountId: account.id,
              status: 'PUBLISHED',
              externalPostId: r.externalPostId,
              externalUrl: r.externalUrl ?? null,
              publishedAt: new Date(),
            },
          });
          results.push({ platform: account.platform, ok: true });
        } catch (e) {
          await prisma.postPublication.create({
            data: {
              postId: post.id,
              socialAccountId: account.id,
              status: 'FAILED',
              failureReason: e instanceof Error ? e.message : 'failed',
            },
          });
          results.push({ platform: account.platform, ok: false });
        }
      }
      const anyOk = results.some((r) => r.ok);
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: anyOk ? 'PUBLISHED' : 'FAILED',
          publishedAt: anyOk ? new Date() : null,
        },
      });
      return ok({ post, results });
    }

    // Publish to first FB account
    const fb = accounts.find((a) => a.platform === 'facebook');
    if (!fb) return ok({ post, warning: 'No Facebook account connected' });
    const { publishFacebookPagePost } = await import('@/lib/meta-publish');
    try {
      const r = await publishFacebookPagePost(fb, { message: fullCaption });
      const updated = await prisma.post.update({
        where: { id: post.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          socialAccountId: fb.id,
          platform: 'facebook',
          externalPostId: r.externalPostId,
        },
      });
      return ok({ post: updated });
    } catch (e) {
      await prisma.post.update({
        where: { id: post.id },
        data: { status: 'FAILED', failureReason: e instanceof Error ? e.message : 'failed' },
      });
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/\n{2,}/g, ' ')
    .trim();
}
