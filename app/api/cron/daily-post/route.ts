import { prisma } from '@/lib/prisma';
import { generateDailyPost } from '@/lib/content-generator';
import { generateImage, fetchImageBuffer } from '@/lib/image-provider';
import { applyLogoOverlay } from '@/lib/logo-overlay';
import { isCloudinaryConfigured, uploadBufferToCloudinary } from '@/lib/cloudinary';
import { dispatchPublish } from '@/lib/publish-dispatcher';
import { TEXT_MODEL } from '@/lib/openai';
import { NextResponse } from 'next/server';

/**
 * Vercel Cron entry point.
 * Schedule (vercel.json): hourly. For each user whose `defaultPostTime` matches
 * the current hour, generate today's post + image. If `autoPublish` is on AND
 * the user has connected accounts, publish; otherwise leave AWAITING_APPROVAL.
 *
 * Authorization: requires `Authorization: Bearer ${CRON_SECRET}` header.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Vercel Hobby (free) only allows daily crons, so we generate one post per
  // user per day for everyone with a business profile (regardless of their
  // configured `defaultPostTime`). Upgrade to Vercel Pro for hourly crons.
  const profiles = await prisma.businessProfile.findMany({
    include: { user: true },
  });

  const results: any[] = [];
  for (const profile of profiles) {
    try {
      const recent = await prisma.post.findMany({
        where: { userId: profile.userId, topic: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 14,
        select: { topic: true },
      });
      const generated = await generateDailyPost(profile, {
        recentTopics: recent.map((r) => r.topic!).filter(Boolean),
      });

      const post = await prisma.post.create({
        data: {
          userId: profile.userId,
          topic: generated.topic,
          hook: generated.hook,
          body: generated.body,
          cta: generated.cta,
          hashtags: generated.hashtags,
          websiteLink: profile.websiteUrl,
          fullCaption: generated.fullCaption,
          status: profile.autoPublish ? 'SCHEDULED' : 'AWAITING_APPROVAL',
          modelUsed: TEXT_MODEL,
        },
      });

      // Image
      try {
        const gen = await generateImage({ prompt: generated.imagePrompt });
        const raw = await fetchImageBuffer(gen.url);
        let final = raw;
        let logoApplied = false;
        if (profile.logoUrl) {
          try {
            const logo = await fetchImageBuffer(profile.logoUrl);
            final = await applyLogoOverlay({
              imageBuffer: raw,
              logoBuffer: logo,
              position: profile.logoPosition as any,
            });
            logoApplied = true;
          } catch {}
        }
        let rawUrl = '';
        let finalUrl = '';
        if (isCloudinaryConfigured()) {
          const r = await uploadBufferToCloudinary(raw, { folder: `nextgen-growth/${profile.userId}/raw` });
          const f = logoApplied
            ? await uploadBufferToCloudinary(final, { folder: `nextgen-growth/${profile.userId}/final` })
            : r;
          rawUrl = r.url;
          finalUrl = f.url;
        } else {
          rawUrl = `data:image/png;base64,${raw.toString('base64')}`;
          finalUrl = `data:image/png;base64,${final.toString('base64')}`;
        }
        await prisma.image.create({
          data: {
            userId: profile.userId,
            postId: post.id,
            prompt: generated.imagePrompt,
            provider: gen.provider,
            rawUrl,
            finalUrl,
            width: gen.width,
            height: gen.height,
            logoApplied,
          },
        });
      } catch (imgErr) {
        // Image is optional for FB; log but don't fail the whole job.
      }

      // Auto-publish to ALL connected accounts (FB + IG + Reddit + Dev.to)
      // when autoPublish is on. Each result writes a PostPublication row so
      // the Insights view can show per-platform status.
      if (profile.autoPublish) {
        const accounts = await prisma.socialAccount.findMany({
          where: { userId: profile.userId },
        });
        const reloaded = await prisma.post.findUnique({
          where: { id: post.id },
          include: { image: true },
        });
        if (accounts.length > 0 && reloaded) {
          let anyOk = false;
          let firstAccountId: string | null = null;
          for (const account of accounts) {
            // Reddit needs subreddits configured separately — skip in cron auto-publish
            // unless the user has configured a SyndicationTarget. For simplicity here
            // we only auto-publish to facebook + instagram + devto.
            if (account.platform === 'reddit') continue;
            try {
              const r = await dispatchPublish({ post: reloaded, account, profile });
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
              anyOk = true;
              if (!firstAccountId) firstAccountId = account.id;
            } catch (e) {
              await prisma.postPublication.create({
                data: {
                  postId: post.id,
                  socialAccountId: account.id,
                  status: 'FAILED',
                  failureReason: e instanceof Error ? e.message : 'publish failed',
                },
              });
            }
          }
          await prisma.post.update({
            where: { id: post.id },
            data: anyOk
              ? {
                  status: 'PUBLISHED',
                  publishedAt: new Date(),
                  socialAccountId: firstAccountId ?? undefined,
                  platform: accounts.find((a) => a.id === firstAccountId)?.platform ?? undefined,
                }
              : {
                  status: 'FAILED',
                  failureReason: 'All connected accounts failed to publish',
                },
          });
        }
      }

      results.push({ userId: profile.userId, postId: post.id, status: 'ok' });
    } catch (e) {
      results.push({ userId: profile.userId, status: 'error', error: e instanceof Error ? e.message : 'err' });
    }
  }

  return NextResponse.json({ ranAt: now.toISOString(), results });
}
