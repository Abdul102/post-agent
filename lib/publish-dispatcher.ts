/**
 * Publish dispatcher — given a Post + a SocialAccount, route to the right
 * platform-specific publisher. Returns a uniform result shape so the API can
 * write a `PostPublication` row regardless of platform.
 */

import type { Post, SocialAccount, Image, BusinessProfile } from '@prisma/client';
import { publishFacebookPagePost, publishInstagramPost } from '@/lib/meta-publish';
import { submitToReddit } from '@/lib/publishers/reddit';
import { publishToDevto } from '@/lib/publishers/devto';

export interface DispatchInput {
  post: Post & { image: Image | null };
  account: SocialAccount;
  profile: BusinessProfile | null;
  /// For Reddit: which subreddit to submit to.
  subreddit?: string;
}

export interface DispatchResult {
  externalPostId: string;
  externalUrl?: string | null;
}

export async function dispatchPublish(input: DispatchInput): Promise<DispatchResult> {
  const { post, account, profile, subreddit } = input;
  const websiteUrl = profile?.websiteUrl;

  switch (account.platform) {
    case 'facebook': {
      const imageUrl =
        post.image?.finalUrl && !post.image.finalUrl.startsWith('data:')
          ? post.image.finalUrl
          : undefined;
      const r = await publishFacebookPagePost(account, { message: post.fullCaption, imageUrl });
      return { externalPostId: r.externalPostId };
    }

    case 'instagram': {
      if (!post.image?.finalUrl || post.image.finalUrl.startsWith('data:')) {
        throw new Error('Instagram requires a public HTTPS image (configure Cloudinary).');
      }
      const r = await publishInstagramPost(account, { caption: post.fullCaption, imageUrl: post.image.finalUrl });
      return { externalPostId: r.externalPostId };
    }

    case 'reddit': {
      if (!subreddit) throw new Error('Reddit publish requires a subreddit');
      // For Reddit, we post a LINK post pointing to the user's website,
      // with the post hook as the title. This is the legitimate self-promo
      // pattern (much better received than text walls with promo links).
      const title = post.hook.length > 280 ? post.hook.slice(0, 277) + '…' : post.hook;
      const url = websiteUrl ?? '';
      if (!url) throw new Error('Set your website URL in Settings before posting to Reddit');
      const r = await submitToReddit(account, { subreddit, title, url, kind: 'link' });
      return { externalPostId: r.externalPostId, externalUrl: r.externalUrl };
    }

    case 'devto': {
      // Dev.to is a long-form platform. We expect this dispatcher path to be
      // called with a "post" whose body is rich enough; the body becomes the
      // article content. A CTA + canonical URL is appended for backlink value.
      const tags = (post.hashtags ?? []).slice(0, 4);
      const cta = websiteUrl
        ? `\n\n---\n\n*Originally published on [${profile?.businessName ?? websiteUrl}](${websiteUrl}). Want to discuss? [Contact us](${websiteUrl}#contact).*`
        : '';
      const bodyMarkdown = `${post.hook}\n\n${post.body}\n\n${post.cta}${cta}`;
      const r = await publishToDevto(account, {
        title: post.hook,
        bodyMarkdown,
        tags,
        canonicalUrl: websiteUrl,
        published: true,
        mainImage:
          post.image?.finalUrl && !post.image.finalUrl.startsWith('data:')
            ? post.image.finalUrl
            : undefined,
      });
      return { externalPostId: r.externalPostId, externalUrl: r.externalUrl };
    }

    default:
      throw new Error(`Unsupported platform: ${account.platform}`);
  }
}
