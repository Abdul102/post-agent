import { prisma } from '@/lib/prisma';
import { generateDailyPost } from '@/lib/content-generator';
import { generateImage, fetchImageBuffer } from '@/lib/image-provider';
import { applyLogoOverlay } from '@/lib/logo-overlay';
import { isCloudinaryConfigured, uploadBufferToCloudinary } from '@/lib/cloudinary';
import { dispatchPublish } from '@/lib/publish-dispatcher';
import { TEXT_MODEL } from '@/lib/openai';
import { NextResponse } from 'next/server';

/**
 * High-frequency cron entry point (designed for an external cron service like
 * cron-job.org or Upstash, hitting this every 5-15 minutes).
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`
 *
 * For each user with a PostingSchedule enabled:
 *  - Compute the user's local time (using their schedule's IANA timezone).
 *  - Decide if any of their N daily slots is "due now" (±10 min window).
 *  - If due, ensure they haven't already posted in this slot today, then
 *    generate a post + image and publish to all connected accounts.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const schedules = await prisma.postingSchedule.findMany({ where: { enabled: true } });
  const ranFor: any[] = [];

  for (const sch of schedules) {
    try {
      const local = nowInTimezone(now, sch.timezone);
      // Day-of-week filter
      if (sch.daysOfWeek.length > 0 && !sch.daysOfWeek.includes(local.dow)) continue;

      const slots = computeSlots(sch.startTime, sch.endTime, sch.postsPerDay);
      const minutesNow = local.hh * 60 + local.mm;
      const dueSlot = slots.find((s) => Math.abs(s - minutesNow) <= 10);
      if (dueSlot == null) continue;

      // Idempotency: if a post was already created within the last 30 min
      // for this user, skip — covers external-cron retries / overlap.
      const since = new Date(now.getTime() - 30 * 60 * 1000);
      const recent = await prisma.post.count({
        where: { userId: sch.userId, createdAt: { gte: since } },
      });
      if (recent > 0) continue;

      const profile = await prisma.businessProfile.findUnique({
        where: { userId: sch.userId },
      });
      if (!profile) continue;

      const recentTopics = (
        await prisma.post.findMany({
          where: { userId: sch.userId, topic: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 14,
          select: { topic: true },
        })
      )
        .map((r) => r.topic!)
        .filter(Boolean);

      const generated = await generateDailyPost(profile, { recentTopics });

      const post = await prisma.post.create({
        data: {
          userId: sch.userId,
          topic: generated.topic,
          title: generated.hook.split(/[.!?]/)[0]?.trim().slice(0, 120) ?? null,
          hook: generated.hook,
          body: generated.body,
          cta: generated.cta,
          hashtags: generated.hashtags,
          websiteLink: profile.websiteUrl,
          fullCaption: generated.fullCaption,
          status: sch.autoPublishAll ? 'SCHEDULED' : 'AWAITING_APPROVAL',
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
          const r = await uploadBufferToCloudinary(raw, {
            folder: `nextgen-growth/${sch.userId}/raw`,
          });
          const f = logoApplied
            ? await uploadBufferToCloudinary(final, {
                folder: `nextgen-growth/${sch.userId}/final`,
              })
            : r;
          rawUrl = r.url;
          finalUrl = f.url;
        } else {
          rawUrl = `data:image/png;base64,${raw.toString('base64')}`;
          finalUrl = `data:image/png;base64,${final.toString('base64')}`;
        }
        await prisma.image.create({
          data: {
            userId: sch.userId,
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
      } catch {}

      // Publish
      if (sch.autoPublishAll) {
        const accounts = await prisma.socialAccount.findMany({ where: { userId: sch.userId } });
        const reloaded = await prisma.post.findUnique({
          where: { id: post.id },
          include: { image: true },
        });
        let anyOk = false;
        let firstAccountId: string | null = null;
        for (const account of accounts) {
          if (account.platform === 'reddit') continue;
          if (!reloaded) break;
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
                platform:
                  accounts.find((a) => a.id === firstAccountId)?.platform ?? undefined,
              }
            : { status: 'FAILED', failureReason: 'All connected accounts failed' },
        });
      }

      ranFor.push({ userId: sch.userId, postId: post.id, slot: dueSlot });
    } catch (e) {
      ranFor.push({
        userId: sch.userId,
        error: e instanceof Error ? e.message : 'err',
      });
    }
  }

  return NextResponse.json({ ranAt: now.toISOString(), ranFor });
}

function nowInTimezone(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hh: parseInt(get('hour') || '0', 10),
    mm: parseInt(get('minute') || '0', 10),
    dow: dowMap[get('weekday')] ?? 0,
  };
}

function computeSlots(startTime: string, endTime: string, n: number): number[] {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (n <= 1 || end <= start) return [start];
  const step = Math.floor((end - start) / (n - 1));
  return Array.from({ length: n }, (_, i) => start + step * i);
}
