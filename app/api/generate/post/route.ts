import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { generateDailyPost } from '@/lib/content-generator';
import { TEXT_MODEL } from '@/lib/openai';

const schema = z.object({
  topic: z.string().optional(),
  /** Optional user-supplied title. If provided, used as-is. */
  title: z.string().max(200).optional(),
  /** If true, also generate the image immediately. */
  withImage: z.boolean().optional(),
});

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const body = await req.json().catch(() => ({}));
    const { topic, title } = schema.parse(body);

    const profile = await prisma.businessProfile.findUnique({ where: { userId } });
    if (!profile) return bad('Set up your business profile first', 412);

    // Avoid repeating recent topics
    const recent = await prisma.post.findMany({
      where: { userId, topic: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 14,
      select: { topic: true },
    });
    const recentTopics = recent.map((r) => r.topic!).filter(Boolean);

    const generated = await generateDailyPost(profile, { recentTopics, userTopic: topic });

    // Derive a title if user didn't provide one — use the hook truncated.
    const derivedTitle =
      title?.trim() || generated.hook.split(/[.!?]/)[0]?.trim().slice(0, 120) || null;

    const post = await prisma.post.create({
      data: {
        userId,
        topic: generated.topic,
        title: derivedTitle,
        hook: generated.hook,
        body: generated.body,
        cta: generated.cta,
        hashtags: generated.hashtags,
        websiteLink: profile.websiteUrl,
        fullCaption: generated.fullCaption,
        status: 'DRAFT',
        modelUsed: TEXT_MODEL,
      },
    });

    return ok({ post, imagePrompt: generated.imagePrompt });
  } catch (e) {
    return fail(e);
  }
}
