import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { publishFacebookPagePost, publishInstagramPost } from '@/lib/meta-publish';

/**
 * Manually publish a post (used by the "Approve & Publish" button).
 *
 * Behaviour:
 *  - If the post already has a chosen `socialAccount`, publish there.
 *  - Otherwise, auto-pick: prefer a connected Facebook Page; if the post has
 *    an image and only an IG account is connected, use IG.
 *  - Body may include `{ "platform": "facebook" | "instagram" }` to force one.
 */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const body = await req.json().catch(() => ({} as any));
    const forcedPlatform: 'facebook' | 'instagram' | undefined = body?.platform;

    const post = await prisma.post.findFirst({
      where: { id: ctx.params.id, userId },
      include: { image: true, socialAccount: true },
    });
    if (!post) return bad('Not found', 404);

    // Resolve which account to publish to
    let target = post.socialAccount;
    if (!target) {
      const accounts = await prisma.socialAccount.findMany({ where: { userId } });
      if (accounts.length === 0)
        return bad('No connected social accounts. Connect Facebook first.', 400);

      const fb = accounts.find((a) => a.platform === 'facebook');
      const ig = accounts.find((a) => a.platform === 'instagram');

      if (forcedPlatform === 'instagram') target = ig ?? null;
      else if (forcedPlatform === 'facebook') target = fb ?? null;
      else target = fb ?? (post.image ? ig : null) ?? null;

      if (!target) return bad('No suitable account for this post', 400);
    }

    if (target.platform === 'instagram' && !post.image?.finalUrl) {
      return bad('Instagram posts require an image', 400);
    }
    // IG also requires a public HTTPS image URL — data: URLs won't work.
    if (target.platform === 'instagram' && post.image?.finalUrl?.startsWith('data:')) {
      return bad(
        'Instagram needs a public image URL. Configure Cloudinary in .env to enable IG publishing.',
        400,
      );
    }

    let externalPostId = '';
    try {
      if (target.platform === 'facebook') {
        // Facebook can only attach an image if it's a public HTTPS URL.
        // Data-URL fallbacks (no Cloudinary) → publish text-only.
        const imageUrl =
          post.image?.finalUrl && !post.image.finalUrl.startsWith('data:')
            ? post.image.finalUrl
            : undefined;
        const r = await publishFacebookPagePost(target, {
          message: post.fullCaption,
          imageUrl,
        });
        externalPostId = r.externalPostId;
      } else {
        const r = await publishInstagramPost(target, {
          caption: post.fullCaption,
          imageUrl: post.image!.finalUrl,
        });
        externalPostId = r.externalPostId;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Publish failed';
      const failed = await prisma.post.update({
        where: { id: post.id },
        data: { status: 'FAILED', failureReason: msg, socialAccountId: target.id, platform: target.platform },
      });
      return ok({ post: failed, error: msg }, { status: 502 });
    }

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        externalPostId,
        socialAccountId: target.id,
        platform: target.platform,
        failureReason: null,
      },
    });
    return ok({ post: updated });
  } catch (e) {
    return fail(e);
  }
}
